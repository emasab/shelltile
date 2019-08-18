const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");

function FakeWindow(){
    this._init.apply(this, arguments);
}

FakeWindow.prototype = {
    _init: function (extension, win){
        this.log = Log.getLogger("FakeWindow");
        this.x = 0;
        this.y = 0;
        this.w = 0;
        this.h = 0;
        this.extension = extension;
        this.group = null;

        if (win){
            this.original_win = win;
            var bounds = win.outer_rect();
            this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);
        }
    },
    
    bring_to_front: function (){},
    is_active: function (){
        return false;
    },
    activate: function (){},
    is_minimized: function (){
        return false;
    },
    
    is_maximized: function (){
        return false;
    },
    
    before_group: function (){},
    
    after_group: function (keep_position){},
    
    minimize: function (){},
    
    maximize: function (){},
    
    unmaximize: function (){},
    
    unminimize: function (){},
    
    showing_on_its_workspace: function (){
        return true;
    },
    
    before_redraw: function (func){},
    
    on_move_to_workspace: function (workspace){},
    
    on_move_to_monitor: function (metaScreen, monitorIndex){},
    
    save_bounds: function (){
        this.save_position();
        this.save_size();
    },
    
    save_position: function (){
        this.saved_position = this.outer_rect();
    },
    
    save_size: function (){
        this.saved_size = this.outer_rect();
    },
    
    move_to_workspace: function (workspace){},
    
    move_to_monitor: function (idx){},
    
    move_resize: function (x, y, w, h){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    },
    
    get_title: function (){
        return this.id();
    },
    toString: function (){
        return ("<#Window FakeWindow: " + this.get_title() + ">");
    },
    
    is_resizeable: function (){
        return true;
    },
    
    window_type: function (){
        return -1;
    },
    window_class: function (){
        return -1;
    },
    is_shown_on_taskbar: function (){
        return false;
    },
    floating_window: function (){
        return false;
    },
    on_all_workspaces: function (){
        return false;
    },
    should_auto_tile: function (){
        return true;
    },
    can_be_tiled: function (){
        return true;
    },
    
    id: function (){
        if (!this._id) this._id = "fake_window_" + FakeWindow.last_id++;
        return this._id;
    },
    
    eq: function (other){
        let eq = this.id() == other.id();
        if (eq && (this != other)){
            if (this.log.is_warn()) this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
        }
        return eq;
    },
    
    get_workspace: function (){
        if (this.original_win) return this.original_win.get_workspace();
    },
    
    get_actor: function (){
        return null;
    },
    
    has_real_window: function (){
        return !!this.original_win;
    },
    
    has_hole: function (){
        return true;
    },
    
    get_maximized_bounds: function (cursor){
        if (this.original_win){
            return this.original_win.get_maximized_bounds(cursor);
        }
    },
    
    maximize_size: function (){
        return null;
    },
    
    get_boundary_edges: function (group_size, current_size){
        return null;

    },
    
    get_modified_edges: function (saved_size, current_size){
        return null;

    },
    
    update_geometry: function (changed_position, changed_size){},
    
    raise: function (){},
    // dimensions
    
    width: function (){
        return this.outer_rect().width;
    },
    height: function (){
        return this.outer_rect().height;
    },
    xpos: function (){
        return this.outer_rect().x;
    },
    ypos: function (){
        return this.outer_rect().y;
    },
    outer_rect: function (){
        return new Meta.Rectangle({
            x: this.x,
            y: this.y,
            width: this.w,
            height: this.h
        });
    },
    get_monitor: function (){
        return null;
    },
    
    clone: function (){
        return new FakeWindow();
    }
};

FakeWindow.last_id = 0;