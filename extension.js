const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;
const Shell      = imports.gi.Shell;
const Mainloop = imports.mainloop;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const ExtensionSystem = imports.ui.extensionSystem;
const Window = Extension.imports.window.Window;
const Workspace = Extension.imports.workspace.Workspace;
const DefaultTilingStrategy = Extension.imports.tiling.DefaultTilingStrategy;
const OverviewModifier = Extension.imports.overview.OverviewModifier;
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");
const Convenience = Extension.imports.convenience;
const Prefs = Extension.imports.prefs;
const Util = Extension.imports.util;
const Compatibility = Extension.imports.util.Compatibility;

class Ext{
    
    constructor(){
        this._init_attributes();
    }

    _init_attributes(){
        this._log = null;
        this._gnome_shell_settings = null;
        this._gnome_mutter_settings = null;
        this._settings = null;
        this._strategy = null;
        this._compatibility = null;
        this.__wsmgr = null;
    
        this.enable_keybindings = null;
        this.enabled = false;
        this.calling = false;
    
        this._workspaces = null;
        this._windows = null;
        this.__shortcuts_binding_ids = null;
        this.__idle_callbacks = null;
        this.__timeout_callbacks = null;
    }

    get compatibility(){
        if (!this._compatibility){
            this._compatibility = new Compatibility();
        }
        return this._compatibility;
    }

    get _wsmgr(){
        if (!this.__wsmgr){
            this.__wsmgr = this.compatibility.get_workspace_manager();
        }
        return this.__wsmgr;
    }

    get _shortcuts_binding_ids(){
        if (!this.__shortcuts_binding_ids){
            this.__shortcuts_binding_ids = [];
        }
        return this.__shortcuts_binding_ids;
    }

    get _idle_callbacks(){
        if (!this.__idle_callbacks){
            this.__idle_callbacks = new Map();
        }
        return this.__idle_callbacks;
    }

    get _timeout_callbacks(){
        if (!this.__timeout_callbacks){
            this.__timeout_callbacks = new Map();
        }
        return this.__timeout_callbacks;
    }

    get workspaces(){
        if (!this._workspaces){
            this._workspaces = {};
        }
        return this._workspaces;
    }

    get windows(){
        if (!this._windows){
            this._windows = {};
        }
        return this._windows;
    }

    get gnome_shell_settings(){
        if (!this._gnome_shell_settings){
            this._gnome_shell_settings = Convenience.getSettings("org.gnome.shell.overrides");
        }
        return this._gnome_shell_settings;
    }

    get gnome_mutter_settings(){
        if (!this._gnome_mutter_settings){
            this._gnome_mutter_settings = Convenience.getSettings("org.gnome.mutter");
        }
        return this._gnome_mutter_settings;
    }

    get settings(){
        if (!this._settings){
            this._settings = Convenience.getSettings();
        }
        return this._settings;
    }

    get strategy(){
        if(!this._strategy){
            this._strategy = new DefaultTilingStrategy(this);
        }
        return this._strategy;
    }

    get log(){
        if (!this._log){
            this._log = Log.getLogger("Ext");
        }
        return this._log;
    }

    connect_and_track (owner, subject, name, cb, realsubject){
        if (!realsubject) realsubject = subject;
        if (!owner.hasOwnProperty('_bound_signals')){
            owner._bound_signals = [];
        }
        owner._bound_signals.push([subject, name, realsubject.connect(name, cb), realsubject]);
    }

    get_topmost_groups (){

        let groups = {};

        for (let id in this.windows){
            let window = this.windows[id];
            if (window.group){

                let group = window.group.get_topmost_group();

                if (group){

                    let group_id = group.id();
                    if (!groups[group_id]){
                        groups[group_id] = group;
                    }

                }

            }
        }

        return groups;
    }

    maximize_grouped_windows (){
        if (!this.enabled) return;

        let groups = this.get_topmost_groups();

        for (let group_id in groups){
            let group = groups[group_id];
            group.maximize_size();
            group.save_bounds();
        }

        //if(this.log.is_debug()) this.log.debug("maximize_grouped_windows");
    }

    resize_grouped_windows (){
        if (!this.enabled) return;

        let groups = this.get_topmost_groups();

        for (let group_id in groups){
            let group = groups[group_id];
            group.reposition();
        }

        //if(this.log.is_debug()) this.log.debug("resize_grouped_windows");		

    }

    load_settings (){

        let last_keep_maximized = this.keep_maximized;
        this.keep_maximized = this.settings.get_boolean("keep-group-maximized");
        this.mouse_split_percent = this.settings.get_boolean("mouse-split-percent");

        let gap = this.settings.get_int("gap-between-windows");
        //if(this.log.is_debug()) this.log.debug("gap: " + gap + " " + this.strategy.DIVISION_SIZE);

        if (this.gap_between_windows === undefined || gap != this.gap_between_windows){
            this.gap_between_windows = gap;
            this.resize_grouped_windows();
        }


        if (this.keep_maximized && last_keep_maximized === false){
            this.maximize_grouped_windows();
        }

        let mod = this.settings.get_string("tile-modifier-key");
        if (mod === undefined)
            mod = "Ctrl";

        this.tile_modifier_key = mod;
        this.enable_edge_tiling = this.settings.get_boolean("enable-edge-tiling");
        this.grouping_edge_tiling = this.settings.get_boolean("grouping-edge-tiling");
        this.edge_zone_width = this.settings.get_int("edge-zone-width");
        this.enable_keybindings = this.settings.get_boolean("enable-keybindings");
    }

    current_display (){
        return this.compatibility.get_display();
    }

    current_window (){
        return this.get_window(this.current_display()['focus-window']);
    }

    get_workspace (meta_workspace){
        let workspace = this.workspaces[meta_workspace];

        if (typeof (workspace) == "undefined"){
            workspace = this.workspaces[meta_workspace] = new Workspace(meta_workspace, this, this.strategy);
        }
        return workspace;
    }

    on_remove_workspace (wm, index){
        const cb = () => {
            this._idle_callbacks.delete(cb);
            if (!this.enabled) return false;
            var removed_meta = null;
            var removed_ws = null;
            for (let k in this.workspaces){
                let v = this.workspaces[k];
                var found = false;
                for (let i = 0; i < wm.get_n_workspaces(); i++){
                    var meta_workspace = wm.get_workspace_by_index(i);
                    if (meta_workspace.toString() == k) found = true;
                }

                if (!found){
                    removed_meta = k;
                    removed_ws = v;
                    break;
                }
            }

            if (removed_meta != null){
                this.remove_workspace(removed_meta);
            }
            return false;
        }
        this._idle_callbacks.set(cb, Mainloop.idle_add(cb));
    }

    remove_workspace (removed_meta){
        if (removed_meta != null && this.workspaces[removed_meta]){
            this.workspaces[removed_meta]._disable();
            delete this.workspaces[removed_meta];
        }
    }

    remove_window (removed_meta){
        if (removed_meta){
            var id = Window.get_id(removed_meta);
            delete this.windows[id];
        }
    }

    get_window (meta_window, create_if_necessary){
        if (typeof (create_if_necessary) == 'undefined'){
            create_if_necessary = true;
        }
        if (!meta_window){
            return null;
        }
        var id = Window.get_id(meta_window);
        //if(this.log.is_debug()) this.log.debug("get_window " + id);
        var win = this.windows[id];
        if (typeof (win) == "undefined" && create_if_necessary){
            win = this.windows[id] = new Window(meta_window, this);
        }
        return win;
    }

    _init_workspaces (){
        const _init_workspace = (i) => {
            this.get_workspace(this._wsmgr.get_workspace_by_index(i));
        };

        this.connect_and_track(this, this._wsmgr, 'workspace-added', (screen, i) => {
            _init_workspace(i);
        });
        this.connect_and_track(this, this._wsmgr, 'workspace-removed', this.on_remove_workspace.bind(this));

        for (var i = 0; i < this._wsmgr.get_n_workspaces(); i++){
            _init_workspace(i);
        }
    }

    _disconnect_workspaces (){
        for (var k in this.workspaces){
            if (this.workspaces.hasOwnProperty(k)){
                this.remove_workspace(k);
            }
        }
    }

    _idle_remove_all(){
        for(const idle_id of this._idle_callbacks.values()){
            Mainloop.idle_remove(idle_id);
        }
    }

    _timeout_remove_all(){
        for(const event_source_id of this._timeout_callbacks.values()){
            Mainloop.source_remove(event_source_id);
        }
    }

    timeout_add(timeout, cb){
        const event_source_id = Mainloop.timeout_add(timeout, () => {
            let ret = undefined;
            try {
                ret = cb();
                return ret;
            } finally {
                if (ret === false){
                    this._timeout_callbacks.delete(cb);
                }
            } 
        });
        this._timeout_callbacks.set(cb, event_source_id);
        return event_source_id;
    }

    timeout_cancel(event_source_id){
        for(const [cb, current_event_source_id] of this._timeout_callbacks.entries()){
            if (current_event_source_id === event_source_id){
                Mainloop.source_remove(event_source_id);
                this._timeout_callbacks.delete(cb);
            }
        }
    }

    disconnect_tracked_signals (owner, object){
        if (owner._bound_signals == null) return;

        var bound_signals1 = [];
        for (var i = 0; i < owner._bound_signals.length; i++){
            var sig = owner._bound_signals[i];
            if (object === undefined || sig[0] === object){
                sig[3].disconnect(sig[2]);
            } else {
                bound_signals1.push(sig);
            }
        }
        owner._bound_signals = bound_signals1;
    }

    remove_default_keybindings (){
        if (this.enable_edge_tiling){
            var edge_tiling = this.gnome_shell_settings.get_boolean("edge-tiling");
            if (edge_tiling === true){
                this.gnome_shell_settings.set_boolean("edge-tiling", false);
            }
            var edge_tiling = this.gnome_mutter_settings.get_boolean("edge-tiling");
            if (edge_tiling === true){
                this.gnome_mutter_settings.set_boolean("edge-tiling", false);
            }
        }
    }

    enable (){
        try {
            //if(this.log.is_debug()) this.log.debug("enabling ShellTile");

            this.enabled = true;
            this.screen = this.compatibility.get_screen();
            this.display = this.compatibility.get_display();

            this.load_settings();
            this.remove_default_keybindings();

            this._init_workspaces();

            var on_window_maximize = this.break_loops(this.on_window_maximize);
            var on_window_unmaximize = this.break_loops(this.on_window_unmaximize);
            var on_window_minimize = this.break_loops(this.on_window_minimize);
            var on_window_manager_window_size_change = this.break_loops(this.on_window_manager_window_size_change);
            var on_window_entered_monitor = this.break_loops(this.window_entered_monitor);
            var on_window_create = this.on_window_create;
            
            this.connect_and_track(this, this.gnome_shell_settings, 'changed', this.on_settings_changed.bind(this));
            this.connect_and_track(this, this.gnome_mutter_settings, 'changed', this.on_settings_changed.bind(this));
            this.connect_and_track(this, this.settings, 'changed', this.on_settings_changed.bind(this));
            this.connect_and_track(this, this.screen, 'window-entered-monitor', on_window_entered_monitor.bind(this));
            this.connect_and_track(this, this.display, 'window_created', on_window_create.bind(this));

            if (Util.versionCompare(undefined, "3.18") >= 0){
                this.connect_and_track(this, global.window_manager, 'size-change', on_window_manager_window_size_change.bind(this));
                this.connect_and_track(this, global.window_manager, 'minimize', on_window_minimize.bind(this));
            } else {
                this.connect_and_track(this, global.window_manager, 'maximize', on_window_maximize.bind(this));
                this.connect_and_track(this, global.window_manager, 'unmaximize', on_window_unmaximize.bind(this));
                this.connect_and_track(this, global.window_manager, 'minimize', on_window_minimize.bind(this));
            }

            if(this.enable_keybindings){
                this.bind_shortcuts();
            }

            OverviewModifier.register(this);
            //if(this.log.is_debug()) this.log.debug("ShellTile enabled");

        } catch (e){
            if (this.log.is_error()) this.log.error(e);
        }
    }

    bind_shortcuts (){
        if(!Main.wm.addKeybinding) return;
        this.unbind_shortcuts();
        if(this.enable_keybindings){
            let accelerators = Prefs.getAccelerators();
            accelerators.forEach((v)=>{
                this.bind_shortcut(v, ()=>{this.on_accelerator(v)});
            })
        }
    }

    unbind_shortcuts(){
        if(!Main.wm.removeKeybinding) return;
        this._shortcuts_binding_ids.forEach(
            (id) => Main.wm.removeKeybinding(id)
        );
    }

    bind_shortcut (name, cb){
        var ModeType = Shell.hasOwnProperty('ActionMode') ?
            Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(
            name,
            this.settings,
            Meta.KeyBindingFlags.NONE,
            ModeType.ALL,
            cb.bind(this)
        );

        this._shortcuts_binding_ids.push(name);
    }

    on_accelerator (accel){
        if (!this.enabled) return;
        if (this.strategy && this.strategy.on_accelerator) this.strategy.on_accelerator(accel);
    }

    on_window_create (display, meta_window, second_try){
        let actor = meta_window.get_compositor_private();
        if (!actor){
            if (!second_try){
                const cb = () => {
                    this._idle_callbacks.delete(cb);
                    if (!this.enabled) return false;
                    this.on_window_create(display, meta_window, true);
                    return false;
                }
                this._idle_callbacks.set(cb, Mainloop.idle_add(cb));
            }
            return;
        }

        let existing = true;
        var win = this.get_window(meta_window, false);
        if (!win){
            existing = false;
            win = this.get_window(meta_window);
        }

        if (win.can_be_tiled()){
            if (this.strategy && this.strategy.on_window_create) this.strategy.on_window_create(win, existing);
            this.connect_window(win, actor);
        }
    }

    on_window_remove (win){
        win = this.get_window(win);
        if(win.marked_for_remove) return;
        win.marked_for_remove = true;

        const cb = () => {
            this._idle_callbacks.delete(cb);
            if (!this.enabled) return false;
            if (win.marked_for_remove){
                if (this.strategy && this.strategy.on_window_remove){
                    this.strategy.on_window_remove(win).then(()=>{
                        this.disconnect_window(win);
                        this.remove_window(win.meta_window);
                    });
                }
            }
            return false;
        };
        this._idle_callbacks.set(cb, Mainloop.idle_add(cb));
        //if(this.log.is_debug()) this.log.debug("window removed " + win);
    }

    async window_entered_monitor (metaScreen, monitorIndex, metaWin){
        if (!this.enabled) return;

        var win = this.get_window(metaWin);
        await win.on_move_to_monitor(metaScreen, monitorIndex);
    }

    on_settings_changed (){
        if (!this.enabled || this.on_settings_changed.automatic) return;

        this.on_settings_changed.automatic = true;
        this.load_settings();
        this.remove_default_keybindings();
        this.bind_shortcuts();
        delete this.on_settings_changed.automatic;
    }

    on_window_position_changed (win){
        if (!this.enabled) return;
        win = this.get_window(win);

        win.resolve_move_promises();
    }

    on_window_size_changed (win){
        if (!this.enabled) return;
        win = this.get_window(win);

        win.resolve_resize_promises();
    }

    async on_window_manager_window_size_change (shellwm, actor){
        if (!this.enabled) return;

        var win = actor.get_meta_window();
        win = this.get_window(win);

        //if(this.log.is_debug()) this.log.debug("window size change");
        if (win.is_maximized()) await this.on_window_maximize(shellwm, actor);
        else {
            if (win.is_minimized()) await this.on_window_minimize(shellwm, actor);
            else await this.on_window_unmaximize(shellwm, actor);
        }
    }

    async on_window_minimize (shellwm, actor){
        if (!this.enabled) return;

        var win = actor.get_meta_window();
        win = this.get_window(win);
        if (this.strategy && this.strategy.on_window_minimize) await this.strategy.on_window_minimize(win);

        //if(this.log.is_debug()) this.log.debug("window maximized " + win);
    }

    async on_window_maximize (shellwm, actor){

        //if(this.log.is_debug()) this.log.debug([shellwm, actor, actor.get_workspace()]);

        var win = actor.get_meta_window();
        win = this.get_window(win);

        if (!this.enabled){

            if (win.group) win.group.detach(win, true);
            return;
        }

        if (this.strategy && this.strategy.on_window_maximize) await this.strategy.on_window_maximize(win);
        //if(this.log.is_debug()) this.log.debug("window maximized " + win);
    }

    async on_window_unmaximize (shellwm, actor){
        if (!this.enabled) return;

        var win = actor.get_meta_window();
        win = this.get_window(win);

        if (this.strategy && this.strategy.on_window_unmaximize) await this.strategy.on_window_unmaximize(win);
        //if(this.log.is_debug()) this.log.debug("window unmaximized " + win);
    }

    async on_workspace_changed (win, obj){
        win = this.get_window(win);

        if (!this.enabled){
            if (win.group) await win.group.detach(win, true);
            return;
        }

        //if(this.log.is_debug()) this.log.debug("workspace_changed");
        var workspace = win.get_workspace();
        //if(this.log.is_debug()) this.log.debug("end workspace_changed");
        if (win && workspace) await win.on_move_to_workspace(workspace);
    }

    async on_window_raised (win){
        if (!this.enabled) return;

        win = this.get_window(win);
        if (this.strategy && this.strategy.on_window_raised) await this.strategy.on_window_raised(win);
        //if(this.log.is_debug()) this.log.debug("window raised " + win);
    }

    async on_window_move (win){
        if (!this.enabled) return;

        if (this.strategy && this.strategy.on_window_move) await this.strategy.on_window_move(win);
        //if(this.log.is_debug()) this.log.debug("window move " + win.xpos() + "," + win.ypos());
    }

    async on_window_resize (win){
        if (!this.enabled) return;

        if (this.strategy && this.strategy.on_window_resize) await this.strategy.on_window_resize(win);
        //if(this.log.is_debug()) this.log.debug("window resize");
    }

    async on_window_moved (win){
        if (!this.enabled) return;

        if (this.strategy && this.strategy.on_window_moved) await this.strategy.on_window_moved(win);
        //if(this.log.is_debug()) this.log.debug("window moved");
    }

    async on_window_resized (win){
        if (!this.enabled) return;

        if (this.strategy && this.strategy.on_window_resized) await this.strategy.on_window_resized(win);
    }

    break_loops (func){
        func = func.bind(this);
        const ret = async function (...args){
            if (this.calling === true) return;
            this.calling = true;
            try {
                await func(...args);
            } finally {
                this.calling = false;
            }
        }
        return ret.bind(this);
    }

    bind_to_window_change (win, actor){
        var requested_win_id = Window.get_id(win.meta_window);
            
        var catch_errors = async (cb, win) => {
            if (cb){
                try { 
                    await cb(win);
                }
                catch(e){
                    if(this.log.is_error()) this.log.error(e);
                }
            }
        }

        return (relevant_grabs, cb, cb_final) => {
            var active = false;
            var grab_begin = async (display, screen, window, grab_op) => {
                if(!window) return;
                var win_id = Window.get_id(window);
                if(requested_win_id!=win_id) return;
                if (relevant_grabs.indexOf(grab_op) == -1) return;
                active = true;
                while (active){
                    await catch_errors(cb, win);
                    if (!active) return;
                    grab_op = display.get_grab_op();
                    if (relevant_grabs.indexOf(grab_op) == -1){
                        active = false;
                        await catch_errors(cb_final, win);
                    }
                    if (active){
                        await new Promise((resolve) => this.timeout_add(200, () => {
                            resolve();
                            return false;
                        }));
                    }
                }
            }
            var grab_end = async (display, screen, window, grab_op) => {
                if(!window) return;
                var win_id = Window.get_id(window); 
                if(requested_win_id!=win_id) return;
                if (!active) return;
                if (relevant_grabs.indexOf(grab_op) == -1) return;
                active = false;
                await catch_errors(cb_final, win);
            }


            this.connect_and_track(this, win, 'grab-op-begin', grab_begin, this.display);
            this.connect_and_track(this, win, 'grab-op-end', grab_end, this.display);
        };
    }

    disconnect_window (win){
        //if(this.log.is_debug()) this.log.debug("disconnect_window");
        var actor = win.get_actor();
        if (actor) this.disconnect_tracked_signals(this, actor);
        this.disconnect_tracked_signals(this, win.meta_window);
        delete win._connected;
    }

    connect_window (win){
        if (!win.can_be_tiled() || win._connected){
            return;
        }

        //if(this.log.is_debug()) this.log.debug("connect_window: " + win);

        var actor = win.get_actor();
        var meta_window = win.meta_window;
        let bind_to_window_change = this.bind_to_window_change(win, actor);

        var on_window_remove = this.break_loops(this.on_window_remove);
        this.connect_and_track(this, meta_window, 'unmanaged', this.on_window_remove.bind(this));

        let move_ops = [
            Meta.GrabOp.MOVING,
            Meta.GrabOp.KEYBOARD_MOVING
        ];
        let resize_ops = [
            Meta.GrabOp.RESIZING_SE,
            Meta.GrabOp.RESIZING_S,
            Meta.GrabOp.RESIZING_SW,
            Meta.GrabOp.RESIZING_N,
            Meta.GrabOp.RESIZING_NE,
            Meta.GrabOp.RESIZING_NW,
            Meta.GrabOp.RESIZING_W,
            Meta.GrabOp.RESIZING_E,
            Meta.GrabOp.KEYBOARD_RESIZING_NE,
            Meta.GrabOp.KEYBOARD_RESIZING_NW,
            Meta.GrabOp.KEYBOARD_RESIZING_SE,
            Meta.GrabOp.KEYBOARD_RESIZING_SW,
            Meta.GrabOp.KEYBOARD_RESIZING_N,
            Meta.GrabOp.KEYBOARD_RESIZING_E,
            Meta.GrabOp.KEYBOARD_RESIZING_S,
            Meta.GrabOp.KEYBOARD_RESIZING_W,
            Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN
        ];
        var on_window_move = this.break_loops(this.on_window_move);
        var on_window_moved = this.break_loops(this.on_window_moved);
        var on_window_resize = this.break_loops(this.on_window_resize);
        var on_window_resized = this.break_loops(this.on_window_resized);
        var on_window_raised = this.break_loops(this.on_window_raised);
        var on_workspace_changed = this.break_loops(this.on_workspace_changed);
        var on_window_size_changed = this.on_window_size_changed;
        var on_window_position_changed = this.on_window_position_changed;

        bind_to_window_change(move_ops, on_window_move.bind(this), on_window_moved.bind(this));
        bind_to_window_change(resize_ops, on_window_resize.bind(this), on_window_resized.bind(this));
        this.connect_and_track(this, meta_window, 'raised', on_window_raised.bind(this));
        this.connect_and_track(this, meta_window, "workspace_changed", on_workspace_changed.bind(this));
        this.connect_and_track(this, meta_window, 'position-changed', on_window_position_changed.bind(this));
        this.connect_and_track(this, meta_window, 'size-changed', on_window_size_changed.bind(this));
        win._connected = true;
    }

    disable (){
        try {
            OverviewModifier.unregister(this);
            this.unbind_shortcuts();
            this._disconnect_workspaces();
            this.disconnect_tracked_signals(this);
            this._idle_remove_all();
            this._timeout_remove_all();
            this.gnome_shell_settings.reset("edge-tiling");
            this.gnome_mutter_settings.reset("edge-tiling");
            this._init_attributes();
            //if(this.log.is_debug()) this.log.debug("ShellTile disabled");

        } catch (e){
            this.log.error(e);
            if (this.log.is_error()) this.log.error(e);
        }
    }

}

function init(){
    let ext = new Ext();
    return ext
}