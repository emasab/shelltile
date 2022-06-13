const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Mainloop = imports.mainloop;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");

var Window = class Window{

    static get_id (w){
        if (!w || !w.get_stable_sequence){
            Log.getLogger("shelltile").error("Non-window object: " + w);
        }
        return w.get_stable_sequence();
    }

    constructor(meta_window, ext){
        this.meta_window = meta_window;
        this.extension = ext;
        this.log = Log.getLogger("Window");
        this.group = null;
        this.move_promises = [];
        this.resize_promises = [];
        this.min_size = {width: 1, height: 1};
    }


    bring_to_front(){
        // NOOP (TODO: remove)
    }

    is_active (){
        return this.ext.current_window() === this;
    }

    activate (){
        Main.activateWindow(this.meta_window);
    }

    is_minimized (){
        return this.meta_window.minimized;
    }

    is_maximized (){
        return this.meta_window.maximized_horizontally || this.meta_window.maximized_vertically;
    }
    
    before_group (){
        if (!this.before_group_size) this.before_group_size = this.outer_rect();
    }

    has_moved_enough_for_detach (){
        if(!this.saved_position) return false;
        else {
            var dist = Math.sqrt(
                Math.pow(this.xpos()-this.saved_position.x,2)+
            Math.pow(this.ypos()-this.saved_position.y,2)
            );
            return dist > Window.MINIMUM_MOVE_FOR_DETACH;
        }
    }
    
    async after_group (keep_position){
        if (this.before_group_size){
            var bounds = this.get_maximized_bounds();
            if (bounds){
                this.unmaximize();
                var current = this.outer_rect();
                current.width = this.before_group_size.width;
                current.height = this.before_group_size.height;
                if (!keep_position && !bounds.contains_rect(current)){
                    current.x = current.x - (current.x + current.width - bounds.x - bounds.width);
                    current.y = current.y - (current.y + current.height - bounds.y - bounds.height);
                    if (current.x < bounds.x) current.x = bounds.x;
                    if (current.y < bounds.y) current.y = bounds.y;
                }

                await this.move_resize(current.x, current.y, current.width, current.height);
                delete this.before_group_size;
            }
        }
    }
    
    minimize (){
        this.meta_window.minimize();
    }
    
    maximize (){
        this.meta_window.maximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
    }
    
    unmaximize (){
        this.meta_window.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
    }
    
    unminimize (){
        this.meta_window.unminimize();
    }
    
    showing_on_its_workspace (){
        return this.meta_window.showing_on_its_workspace();
    }
    
    async on_move_to_workspace (workspace){

        delete this.marked_for_remove;

        if (this.group){
            this.group.move_to_workspace(workspace);
            var group = this.group.get_topmost_group();
            if (this.extension.keep_maximized){
                await group.maximize_size();
            }
            group.raise();
            group.save_bounds();
        }
    }
    
    async on_move_to_monitor (metaScreen, monitorIndex){
        delete this.marked_for_remove;
        if (this.group){
            await this.update_geometry(true, false);
        }
    }
    
    save_bounds (){
        this.save_position();
        this.save_size();
    }
    
    save_position (){
        this.saved_position = this.outer_rect();
    }
    
    save_size (){
        this.saved_size = this.outer_rect();
    }
    
    move_to_workspace (workspace){
        if (!workspace) return;
        this.meta_window.change_workspace(workspace.meta_workspace);
        delete this.marked_for_remove;
    }
    
    move_to_monitor (idx){
        this.meta_window.move_to_monitor(idx);
        delete this.marked_for_remove;
    }

    create_promise (timeout = 100){
        var tmp = {};
        var ret = new Promise((resolve, reject) => {
            Object.assign(tmp, {resolve: resolve, reject: reject});
        })
        Object.assign(ret, tmp);
        this.extension.timeout_add(timeout, () => {
            ret.resolve();
            return false;
        });
        return ret;
    }

    next_move (){
        const move_promise = this.create_promise()
        move_promise.catch(()=>{})
        this.move_promises.push(move_promise);
        return move_promise;
    }

    next_resize (){
        const resize_promise = this.create_promise()
        resize_promise.catch(()=>{})
        this.resize_promises.push(resize_promise);
        return resize_promise;
    }

    get_min_size (){
        return Object.assign({}, this.min_size);
    }
    
    async move_resize(x, y, w, h){
        let outer_rect = this.outer_rect();
        if (!this.saved_position){
            this.saved_position = {x: outer_rect.x, y: outer_rect.y};
        }
        if (!this.saved_size){
            this.saved_size = {width: outer_rect.width, height: outer_rect.height};
        }
        const is_move = x !== outer_rect.x ||
                        y !== outer_rect.y;
        const is_resize = w !== outer_rect.width || 
                        h !== outer_rect.height;

        this.saved_position.x = x;
        this.saved_position.y = y;
        this.saved_size.width = w;
        this.saved_size.height = h;

        const promises = [];
        if(is_move){
            const move_promise = this.next_move();
            promises.push(move_promise);
            this.meta_window.move_frame(true, x, y);
        }
        if(is_resize){
            const resize_promise = this.next_resize()
            promises.push(resize_promise);
            this.meta_window.move_resize_frame(true, x, y, w, h);
        }
        const ret = await Promise.all(promises);
        if(is_resize){
            let outer_rect_after = this.outer_rect();
            if (outer_rect_after.width > w) this.min_size.width = outer_rect_after.width;
            if (outer_rect_after.height > h) this.min_size.height = outer_rect_after.height;
        }
        return ret;
    }

    resolve_move_promises (descending){
        this.move_promises.map(p => p.resolve(null));
        this.move_promises = [];
    }

    resolve_resize_promises (descending){
        this.resize_promises.map(p => p.resolve(null));
        this.resize_promises = [];
    }
    
    get_title (){
        return this.meta_window.get_title();
    }
    toString (){
        return ("<#Window with MetaWindow: " + this.get_title() + ">");
    }
    
    is_resizeable (){
        return this.meta_window.resizeable;
    }
    
    window_type (){
        try {
            return this.meta_window['window-type'];
        } catch (e){
            //TODO: shouldn't be necessary
            if (this.log.is_error()) this.log.error("Failed to get window type for window " + this.meta_window + ", error was:", e);
            return -1;
        }
    }
    window_class (){
        return this.meta_window.get_wm_class();
    }
    is_shown_on_taskbar (){
        return !this.meta_window.is_skip_taskbar();
    }
    floating_window (){
        //TODO: add check for this.meta_window.below when mutter exposes it as a property;
        return this.meta_window.above;
    }
    on_all_workspaces (){
        return this.meta_window.is_on_all_workspaces();
    }
    should_auto_tile (){
        return this.can_be_tiled() && this.is_resizeable() &&
            !(this.floating_window() || this.on_all_workspaces());
    }
    can_be_tiled (){
        if (this.meta_window.is_skip_taskbar()){
            //if(this.log.is_debug()) this.log.debug("uninteresting window: " + this);
            return false;
        }
        var window_class = this.window_class();
        var blacklisted = Window.blacklist_classes.indexOf(window_class) != -1;
        if (blacklisted){
            //if(this.log.is_debug()) this.log.debug("window class " + window_class + " is blacklisted");
            return false;
        }

        var window_type = this.window_type();
        var result = Window.tileable_window_types.indexOf(window_type) != -1;

        return result;
    }
    
    id (){
        return Window.get_id(this.meta_window);
    }
    
    eq (other){
        let eq = this.id() == other.id();
        if (eq && (this != other)){
            if (this.log.is_warn()) this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
        }
        return eq;
    }
    
    get_workspace (){
        var meta_workspace = this.meta_window.get_workspace();
        if (meta_workspace){
            return this.extension.get_workspace(meta_workspace);
        } else return null;
    }
    
    get_actor (){
        return this.meta_window.get_compositor_private();
    }
    
    has_real_window (){
        return true;
    }
    
    has_hole (){
        return false;
    }
    
    get_maximized_bounds (cursor){

        if (cursor) var monitor = Main.layoutManager.currentMonitor.index;
        else var monitor = Main.layoutManager.findMonitorForActor(this.get_actor()).index;
        if (Main.layoutManager && Main.layoutManager.getWorkAreaForMonitor) var ret = Main.layoutManager.getWorkAreaForMonitor(monitor);
        else {
            // < 3.8
            var ret = global.gdk_screen.get_monitor_workarea(monitor);
        }

        return new Meta.Rectangle({
            x: ret.x,
            y: ret.y,
            width: ret.width,
            height: ret.height
        });
    }
    
    maximize_size (){
        var bounds = this.get_maximized_bounds();
        this.maximize();
        return this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);
    }
    
    get_boundary_edges (group_size, current_size){

        var ret = Window.NO_EDGES;

        if (Math.abs(current_size.x - group_size.x) <= 1){

            ret |= Window.LEFT_EDGE;

        }

        if (Math.abs(current_size.y - group_size.y) <= 1){

            ret |= Window.TOP_EDGE;

        }

        if (Math.abs((current_size.x + current_size.width) - (group_size.x + group_size.width)) <= 1){

            ret |= Window.RIGHT_EDGE;

        }

        if (Math.abs((current_size.y + current_size.height) - (group_size.y + group_size.height)) <= 1){

            ret |= Window.BOTTOM_EDGE;

        }

        return ret;

    }

    has_position_size_changed (){
        return this.get_modified_edges(this.saved_size, this.outer_rect());
    }
    
    get_modified_edges (saved_size, current_size){

        var ret = Window.NO_EDGES;

        if (Math.abs(current_size.x - saved_size.x) > 1){

            ret |= Window.LEFT_EDGE;

        }

        if (Math.abs(current_size.y - saved_size.y) > 1){

            ret |= Window.TOP_EDGE;

        }

        if (Math.abs((current_size.x + current_size.width) - (saved_size.x + saved_size.width)) > 1){

            ret |= Window.RIGHT_EDGE;

        }

        if (Math.abs((current_size.y + current_size.height) - (saved_size.y + saved_size.height)) > 1){

            ret |= Window.BOTTOM_EDGE;

        }

        return ret;


    }
    
    async update_geometry (changed_position, changed_size){
        if (this.group){

            var same_size = true;

            if (!this.extension.keep_maximized){

                var group = this.group.get_topmost_group();
                //var group_size = group.outer_rect();
                var current_size = this.outer_rect();

                if (changed_size){

                    var boundary_edges = this.get_boundary_edges(group.saved_size, this.saved_size);
                    var modified_edges = this.get_modified_edges(this.saved_size, current_size);

                    //if(this.log.is_debug()) this.log.debug("boundary_edges : " + boundary_edges);
                    //if(this.log.is_debug()) this.log.debug("modified_edges: " + modified_edges);

                    if ((boundary_edges & modified_edges) > 0){

                        var saved_size = group.saved_size;
                        var saved_position = group.saved_position;

                        if (boundary_edges & Window.RIGHT_EDGE || boundary_edges & Window.LEFT_EDGE){
                            saved_size.width = saved_size.width + (current_size.width - this.saved_size.width);
                        }
                        if (boundary_edges & Window.BOTTOM_EDGE || boundary_edges & Window.TOP_EDGE){
                            saved_size.height = saved_size.height + (current_size.height - this.saved_size.height);
                        }
                        if (boundary_edges & Window.TOP_EDGE){
                            saved_position.y = current_size.y;
                        }
                        if (boundary_edges & Window.LEFT_EDGE){
                            saved_position.x = current_size.x;
                        }

                        same_size = false;
                    }

                }

                if (changed_position){

                    var delta_x = (current_size.x - this.saved_position.x);
                    var delta_y = (current_size.y - this.saved_position.y);

                    group.saved_position.x += delta_x;
                    group.saved_position.y += delta_y;
                    same_size = false;

                }
            }


            if (same_size){
                await this.group.update_geometry(this);
            } else {
                await group.move_resize(group.saved_position.x, group.saved_position.y, group.saved_size.width, group.saved_size.height);
                group.save_bounds();
                group.forget_last_bounds();
            }

        }
    }
    
    raise (){
        if (this.marked_for_remove) return;
        this.unminimize();
        this.meta_window.raise();
    }

    // dimensions
    width (){
        return this.outer_rect().width;
    }
    height (){
        return this.outer_rect().height;
    }
    xpos (){
        return this.outer_rect().x;
    }
    ypos (){
        return this.outer_rect().y;
    }
    real_outer_rect (){
        if (this.meta_window.get_frame_rect) return this.meta_window.get_frame_rect();
        else {
            // removed in 3.16
            return this.meta_window.get_outer_rect();
        }
    }

    outer_rect (){
        if (this.is_maximized() && this.saved_size){
            var ret = this.saved_size;
            if (this.saved_position){
                ret.x = this.saved_position.x;
                ret.y = this.saved_position.y;
            }
            return ret;
        } else {
            return this.real_outer_rect();
        }
    }
    get_monitor (){
        return this.meta_window.get_monitor();
    }
    
    clone (){
        var ret = new Window(this.meta_window, this.extension);
        ret.group = this.group;
        return ret;
    }
}

Window.tileable_window_types = [
    Meta.WindowType.NORMAL
];

Window.blacklist_classes = [
    'Conky'
];

Window.MINIMUM_MOVE_FOR_DETACH = 30;

Window.NO_EDGES = parseInt("0000", 2);
Window.RIGHT_EDGE = parseInt("0001", 2);
Window.BOTTOM_EDGE = parseInt("0010", 2);
Window.LEFT_EDGE = parseInt("0100", 2);
Window.TOP_EDGE = parseInt("1000", 2);
