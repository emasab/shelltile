const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
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
const Util = Extension.imports.util;
const KeyManager = Extension.imports.keymanager.KeyManager;

const Ext = function Ext(){
	let self = this;
	let OVERRIDE_SCHEMA = "org.gnome.shell.overrides";
	let MUTTER_SCHEMA = "org.gnome.mutter";
	let KEYBINDING_SCHEMA = "org.gnome.desktop.wm.keybindings";
	let KEYBINDING_SCHEMA_MUTTER = "org.gnome.mutter.keybindings";
	
    self.log = Log.getLogger("Ext");
    
	self.gnome_shell_settings = Convenience.getSettings(OVERRIDE_SCHEMA);
	self.gnome_mutter_settings = Convenience.getSettings(MUTTER_SCHEMA);
    self.settings = Convenience.getSettings();
    self.keybindingSettings = Convenience.getSettings(KEYBINDING_SCHEMA);
    self.keybindingSettingsMutter = Convenience.getSettings(KEYBINDING_SCHEMA_MUTTER);
    
    self.enabled = false;
	
    self.workspaces = {};
	self.windows = {};
	self.strategy = new DefaultTilingStrategy(self);
	
	self._shellwm =  global.window_manager;
	
	self.connect_and_track = function(owner, subject, name, cb, realsubject) {
		if(!realsubject) realsubject = subject;
		if (!owner.hasOwnProperty('_bound_signals')) {
			owner._bound_signals = [];
		}
		owner._bound_signals.push([subject, name, realsubject.connect(name, cb), realsubject]);
	};
	
	self.get_topmost_groups = function(){

		let groups = {};
		
		for(let id in self.windows){
			let window = self.windows[id];
			if(window.group){
				
				let group = window.group.get_topmost_group();
								
				if(group){
					
					let group_id = group.id();
					if(!groups[group_id]){
						groups[group_id] = group;
					}
					
				}
				
			}
		}
		
		return groups;
		
	}
	
	self.maximize_grouped_windows = function(){
		if(!self.enabled) return;
		
		let groups = self.get_topmost_groups();
		
		for(let group_id in groups){
			let group = groups[group_id];
			group.maximize_size();
			group.save_bounds();
		}
		
		//if(this.log.is_debug()) this.log.debug("maximize_grouped_windows");
	}
	
	self.resize_grouped_windows = function(){
		if(!self.enabled) return;

		let groups = self.get_topmost_groups();
		
		for(let group_id in groups){
			let group = groups[group_id];
			group.reposition();
		}
		
		//if(this.log.is_debug()) this.log.debug("resize_grouped_windows");		
		
	}
	
	self.load_settings = function(){
		
		let last_keep_maximized = self.keep_maximized;
		self.keep_maximized = self.settings.get_boolean("keep-group-maximized");
		self.mouse_split_percent = self.settings.get_boolean("mouse-split-percent");
		
		let gap = self.settings.get_int("gap-between-windows");
		//if(this.log.is_debug()) this.log.debug("gap: " + gap + " " + self.strategy.DIVISION_SIZE);
		
		if(self.gap_between_windows === undefined || gap != self.gap_between_windows){
			self.gap_between_windows = gap;
			self.resize_grouped_windows();
		}
		
		
		if(self.keep_maximized && last_keep_maximized === false){
			self.maximize_grouped_windows();			
		}
		
		let mod = self.settings.get_string("tile-modifier-key");
		if (mod === undefined)
		  mod = "Ctrl";
		
		self.tile_modifier_key = mod;

		self.top_edge_max = self.settings.get_boolean("top-edge-maximize");
	};
	
	self.current_display = function current_display() {
		return global.screen.get_display();
	};

	self.current_window = function current_window() {
		return self.get_window(self.current_display()['focus-window']);
	};
	
	self.get_workspace = function get_workspace(meta_workspace) {
		let workspace = self.workspaces[meta_workspace];
		
    	if(typeof(workspace) == "undefined") {
			workspace = self.workspaces[meta_workspace] = new Workspace(meta_workspace, self, self.strategy);
		}
		return workspace;
	};
	
	self.on_remove_workspace = function(screen, index) {
		Mainloop.idle_add(Lang.bind(this, function () {
		   
		    var removed_meta = null;
		    var removed_ws = null;
		    for(let k in self.workspaces){
			    let v = self.workspaces[k];
			    var found = false;
			    for(let i=0; i<screen.get_n_workspaces();i++){
				    var meta_workspace = screen.get_workspace_by_index(i);
				    if(meta_workspace.toString() == k) found = true;
			    }

			    if(!found){
				    removed_meta = k;
				    removed_ws = v;
				    break;
			    }
		    }
		
		    if(removed_meta != null) {
			    self.remove_workspace(removed_meta);
		    }
			return false;
		
        }));


	};
	
	self.remove_workspace = function(removed_meta) {	
		if(removed_meta != null && self.workspaces[removed_meta]) {
			self.workspaces[removed_meta]._disable();
			delete self.workspaces[removed_meta];
		}
	};
	
	self.remove_window = function(removed_meta){
		if(removed_meta){
			var id = Window.get_id(removed_meta);
			delete self.windows[id];
		}
	};
	
	self.get_window = function get_window(meta_window, create_if_necessary) {
		if(typeof(create_if_necessary) == 'undefined') {
			create_if_necessary = true;
		}
		if(!meta_window) {
			return null;
		}
		var id = Window.get_id(meta_window);
		//if(this.log.is_debug()) this.log.debug("get_window " + id);
		var win = self.windows[id];
		if(typeof(win) == "undefined" && create_if_necessary) {
			win = self.windows[id] = new Window(meta_window, self);
		}
		return win;
	};
	
	
	self._init_workspaces = function() {

		function _init_workspace (i) {
			self.get_workspace(self.screen.get_workspace_by_index(i));
		};

		self.connect_and_track(self, self.screen, 'workspace-added', function(screen, i) { _init_workspace(i); });
		self.connect_and_track(self, self.screen, 'workspace-removed', self.on_remove_workspace);
		
		for (var i = 0; i < self.screen.n_workspaces; i++) {
			_init_workspace(i);
		}

	};

	self._disconnect_workspaces = function() {
		for (var k in self.workspaces) {
			if (self.workspaces.hasOwnProperty(k)) {
				self.remove_workspace(k);
			}
		}
	};

	self.disconnect_tracked_signals = function(owner, object) {
		if(owner._bound_signals == null) return;
		
		var bound_signals1 = [];
		for(var i=0; i<owner._bound_signals.length; i++) {
			var sig = owner._bound_signals[i];
			if(object === undefined || sig[0] === object){
				sig[3].disconnect(sig[2]);
			} else {
				bound_signals1.push(sig);
			}
		}
		owner._bound_signals = bound_signals1;
	};
	
	self.remove_default_keybindings = function(){
        var edge_tiling = self.gnome_shell_settings.get_boolean("edge-tiling");
        if(edge_tiling === true){
            self.gnome_shell_settings.set_boolean("edge-tiling", false);
        }
        var edge_tiling = self.gnome_mutter_settings.get_boolean("edge-tiling");
        if(edge_tiling === true){
            self.gnome_mutter_settings.set_boolean("edge-tiling", false);
        }
        self.keybindingSettings.reset("maximize");
        self.keybindingSettings.reset("unmaximize");
        self.keybindingSettingsMutter.reset("toggle-tiled-left");
        self.keybindingSettingsMutter.reset("toggle-tiled-right");
	}

	self.enable = function(){
	    try {
	    	//if(self.log.is_debug()) self.log.debug("enabling ShellTile");
	
            self.enabled = true;
            self.screen = global.screen;
            let screen = self.screen;
            
            self.remove_default_keybindings();
            self.load_settings();
            
            if(!self.initialized){
            	self.initialized = true;
	            self._init_workspaces();		
	            
	            var on_window_maximize = this.break_loops(this.on_window_maximize);
	    		var on_window_unmaximize = this.break_loops(this.on_window_unmaximize);
	    		var on_window_minimize = this.break_loops(this.on_window_minimize);
	    		var on_window_size_change = this.break_loops(this.on_window_size_change);
	    		var on_window_create = this.break_loops(this.on_window_create);
	    		var on_window_entered_monitor = this.break_loops(this.window_entered_monitor);
	
	            self.connect_and_track(self, self.gnome_shell_settings, 'changed', Lang.bind(this, this.on_settings_changed));
	            self.connect_and_track(self, self.gnome_mutter_settings, 'changed', Lang.bind(this, this.on_settings_changed));
	            self.connect_and_track(self, self.keybindingSettings, 'changed', Lang.bind(this, this.on_settings_changed));
	            self.connect_and_track(self, self.keybindingSettingsMutter, 'changed', Lang.bind(this, this.on_settings_changed));
	            self.connect_and_track(self, self.settings, 'changed', Lang.bind(this, this.on_settings_changed));
	    		self.connect_and_track(self, self.screen, 'window-entered-monitor', Lang.bind(this, on_window_entered_monitor));
	    		self.connect_and_track(self, global.display, 'window_created', Lang.bind(this, on_window_create));
	    		
	    		if(Util.versionCompare(undefined, "3.18") >= 0){
	    			self.connect_and_track(self, self._shellwm, 'size-change', Lang.bind(self, on_window_size_change));
	    			self.connect_and_track(self, self._shellwm, 'minimize', Lang.bind(self, on_window_minimize));
	    		} else {
	    			self.connect_and_track(self, self._shellwm, 'maximize', Lang.bind(self, on_window_maximize));
	    			self.connect_and_track(self, self._shellwm, 'unmaximize', Lang.bind(self, on_window_unmaximize));
	    			self.connect_and_track(self, self._shellwm, 'minimize', Lang.bind(self, on_window_minimize));
	    		}
	    		
	    		
	    		
	    		self.keyManager = new KeyManager()
	    		
	    		var addAccelerator = function(acc, id){
	    			self.keyManager.listenFor(acc, function(){
		    			self.on_accelerator(id);
		    		})
	    		}
	    		//addAccelerator("<super>Left","left");
	    		//addAccelerator("<super>Right","right");
	    		//addAccelerator("<super>Up","up");
	    		//addAccelerator("<super>Down","down");
	    		
	            OverviewModifier.register(self);
            }
            //if(self.log.is_debug()) self.log.debug("ShellTile enabled");
        
	    } catch(e){
            if(self.log.is_error()) self.log.error(e);    
        }
	}
	
	self.on_accelerator = function(accel){
		if(!this.enabled) return;
		if(this.strategy && this.strategy.on_accelerator) this.strategy.on_accelerator(accel);
	}
	
	self.on_window_create = function(display, meta_window, second_try){
		//if(this.log.is_debug()) this.log.debug("window_created: " + meta_window);
		let actor = meta_window.get_compositor_private();
		if(!actor){
			if(!second_try){
				Mainloop.idle_add(Lang.bind(this, function () {
					this.on_window_create(display, meta_window, true);
					return false;
				}));
			}
			return;
		}		
		
		let existing = true;
		var win = this.get_window(meta_window, false);
		if(!win){
			existing = false;
			win = this.get_window(meta_window);
		}
		
		if(win.can_be_tiled()){
			if(this.strategy && this.strategy.on_window_create) this.strategy.on_window_create(win, existing);
			this.connect_window(win, actor);
		}		
	}
	
	self.on_window_remove = function(win) {
		//if(this.log.is_debug()) this.log.debug("window removed " + win);
		win = this.get_window(win);
		win.marked_for_remove = true;
		
		Mainloop.idle_add(Lang.bind(this, function () {
			if(win.marked_for_remove){
				if(this.strategy && this.strategy.on_window_remove) this.strategy.on_window_remove(win);
				this.disconnect_window(win);
				this.remove_window(win.meta_window);				
			}
			return false;
		}));
		
		//if(this.log.is_debug()) this.log.debug("window removed " + win);
	}
	
	self.window_entered_monitor = function(metaScreen, monitorIndex, metaWin){
		if(!this.enabled) return;
		
		var win = self.get_window(metaWin);
		win.on_move_to_monitor(metaScreen, monitorIndex);
	}
	
	self.on_settings_changed = function(){
		if(!this.enabled || self.on_settings_changed.automatic) return;
		
		self.on_settings_changed.automatic = true;
		self.remove_default_keybindings();
		self.load_settings();
		delete self.on_settings_changed.automatic;
	}
	
	self.on_window_size_change = function(shellwm, actor) {
		if(!this.enabled) return;
		
		var win = actor.get_meta_window();
		win = this.get_window(win);
		
		//if(this.log.is_debug()) this.log.debug("window size change");
		if(win.is_maximized()) this.on_window_maximize(shellwm, actor);
		else {
			if(win.is_minimized()) this.on_window_minimize(shellwm, actor);
			else this.on_window_unmaximize(shellwm, actor);
		}
	}
	
	self.on_window_minimize = function(shellwm, actor) {
		if(!this.enabled) return;
		
		var win = actor.get_meta_window();
		win = this.get_window(win);
		if(this.strategy && this.strategy.on_window_minimize) this.strategy.on_window_minimize(win);
		
		//if(this.log.is_debug()) this.log.debug("window maximized " + win);
	}
	
	self.on_window_maximize = function(shellwm, actor) {
		
		//if(this.log.is_debug()) this.log.debug([shellwm, actor, actor.get_workspace()]);
		
		var win = actor.get_meta_window();
		win = this.get_window(win);

		if(!this.enabled){
			
			if(win.group) win.group.detach(win, true);
			return;
		}		
		
		if(this.strategy && this.strategy.on_window_maximize) this.strategy.on_window_maximize(win);
		//if(this.log.is_debug()) this.log.debug("window maximized " + win);
	}
	
	self.on_window_unmaximize = function(shellwm, actor) {
		if(!this.enabled) return;
		
		var win = actor.get_meta_window();
		win = this.get_window(win);
		
		if(this.strategy && this.strategy.on_window_unmaximize) this.strategy.on_window_unmaximize(win);
		//if(this.log.is_debug()) this.log.debug("window unmaximized " + win);
	}
	
	self.on_workspace_changed = function(win, obj){
		win = this.get_window(win);
		
		if(!this.enabled){
			
			if(win.group) win.group.detach(win, true);
			return;
		}
		
		//if(this.log.is_debug()) this.log.debug("workspace_changed");
		var workspace = win.get_workspace();
		//if(this.log.is_debug()) this.log.debug("end workspace_changed");
		if(win && workspace) win.on_move_to_workspace(workspace);
	}
	
	self.on_window_raised = function(win){
		if(!this.enabled) return;
		
		win = this.get_window(win);
		if(this.strategy && this.strategy.on_window_raised) this.strategy.on_window_raised(win);
		//if(this.log.is_debug()) this.log.debug("window raised " + win);
	}
	
	self.on_window_move = function(win) {
		if(!this.enabled) return;
		
		if(this.strategy && this.strategy.on_window_move) this.strategy.on_window_move(win);
		//if(this.log.is_debug()) this.log.debug("window move " + win.xpos() + "," + win.ypos());
	}
	
	self.on_window_resize = function(win) {
		if(!this.enabled) return;
		
		if(this.strategy && this.strategy.on_window_resize) this.strategy.on_window_resize(win);
		//if(this.log.is_debug()) this.log.debug("window resize");
	}
	
	self.on_window_moved = function(win) {
		if(!this.enabled) return;
		
		if(this.strategy && this.strategy.on_window_moved) this.strategy.on_window_moved(win);
		//if(this.log.is_debug()) this.log.debug("window moved");
	}
	
	self.on_window_resized = function(win) {
		if(!this.enabled) return;
		
		if(this.strategy && this.strategy.on_window_resized) this.strategy.on_window_resized(win);
		//if(this.log.is_debug()) this.log.debug("window resized");
	}
	
	self.on_window_drag_begin = function(win) {
		if(!this.enabled) return;
		
		if(this.strategy && this.strategy.on_window_drag_begin) this.strategy.on_window_drag_begin(win);
		//if(this.log.is_debug()) this.log.debug("window drag begin");
	}	
	
	self.on_window_drag_end = function(win) {
		if(!this.enabled) return;
		
		if(this.strategy && this.strategy.on_window_drag_end) this.strategy.on_window_drag_end(win);
		//if(this.log.is_debug()) this.log.debug("window drag end");
	}	

	self.break_loops = function(func){
		return function(){
			if(this.calling === true) return;
			
			this.calling = true;
			try {
				func.apply(this, arguments);
			} finally {
				this.calling = false;
			}
		}
	}	
	
	self.bind_to_window_change = function(win, actor){

		return Lang.bind(this, function(relevant_grabs, cb, cb_final) {
			var win_id = win.id();
			var stopped = false;
			var grab_begin = function(display, screen, window, grab_op){
				if(relevant_grabs.indexOf(grab_op) == -1) return;
				if(win_id != Window.get_id(window)) return;
				
				var repeat = function(){
					grab_op = display.get_grab_op();
					if(relevant_grabs.indexOf(grab_op) == -1){
						if(cb_final) cb_final(win);
						stopped = true;
					}
					if(!stopped){
						if(cb) cb(win);
						Mainloop.timeout_add(200, repeat);
					}
				};
				Mainloop.timeout_add(200, repeat);
				
				stopped = false;
				if(cb) cb(win);
			}
			var grab_end = function(display, screen, window, grab_op){
				if(stopped) return;
				if(relevant_grabs.indexOf(grab_op) == -1) return;
				if(win_id != Window.get_id(window)) return;
				
				if(cb_final) cb_final(win);
				stopped = true;
			}
			

			this.connect_and_track(this, win, 'grab-op-begin', Lang.bind(this, grab_begin), global.display);
			this.connect_and_track(this, win, 'grab-op-end', Lang.bind(this, grab_end), global.display);
		});
		
	}	
	
	self.disconnect_window = function(win){
		//if(this.log.is_debug()) this.log.debug("disconnect_window");
		var actor = win.get_actor();
		if(actor) this.disconnect_tracked_signals(this, actor);
		this.disconnect_tracked_signals(this, win.meta_window);
		delete win._connected;
	}
	
	self.connect_window = function(win){
		if(!win.can_be_tiled() || win._connected) {
			return;
		}
		
		//if(this.log.is_debug()) this.log.debug("connect_window: " + win);
		
		var actor = win.get_actor();
		var meta_window = win.meta_window;
		let bind_to_window_change = this.bind_to_window_change(win, actor);
		
		var on_window_remove = this.break_loops(this.on_window_remove);
		this.connect_and_track(this, meta_window, 'unmanaged', Lang.bind(this, on_window_remove));

		let move_ops = [Meta.GrabOp.MOVING];
		let resize_ops = [
				Meta.GrabOp.RESIZING_SE,
				Meta.GrabOp.RESIZING_S,
				Meta.GrabOp.RESIZING_SW,
				Meta.GrabOp.RESIZING_N,
				Meta.GrabOp.RESIZING_NE,
				Meta.GrabOp.RESIZING_NW,
				Meta.GrabOp.RESIZING_W,
				Meta.GrabOp.RESIZING_E
		];
		var on_window_move = this.break_loops(this.on_window_move);
		var on_window_moved = this.break_loops(this.on_window_moved);
		var on_window_resize = this.break_loops(this.on_window_resize);
		var on_window_resized = this.break_loops(this.on_window_resized);
		var on_window_raised = this.break_loops(this.on_window_raised);
		var on_workspace_changed = this.break_loops(this.on_workspace_changed);
		var on_key_press = this.on_key_press;
		var on_key_release = this.on_key_release;
		
		
		bind_to_window_change(move_ops, Lang.bind(this, on_window_move),  Lang.bind(this, on_window_moved));
		bind_to_window_change(resize_ops, Lang.bind(this, on_window_resize), Lang.bind(this, on_window_resized));
		//this.connect_and_track(this, meta_window, 'drag-begin', Lang.bind(this, on_window_drag_begin));
		//this.connect_and_track(this, meta_window, 'drag-end', Lang.bind(this, on_window_drag_end));
		this.connect_and_track(this, meta_window, 'raised', Lang.bind(this, on_window_raised));
		this.connect_and_track(this, meta_window, "workspace_changed", Lang.bind(this, on_workspace_changed));
		win._connected = true;
	}	

	self.disable = function(){
        try {        
            self.enabled = false;
            self.gnome_shell_settings.reset("edge-tiling");
            self.gnome_mutter_settings.reset("edge-tiling");
            self.keybindingSettings.reset("maximize");
            self.keybindingSettings.reset("unmaximize");
            self.keybindingSettingsMutter.reset("toggle-tiled-left");
            self.keybindingSettingsMutter.reset("toggle-tiled-right");
            //if(self.log.is_debug()) self.log.debug("ShellTile disabled");

        } catch(e){
        	if(self.log.is_error()) self.log.error(e);    
        }
	}
};

function init() {
    let ext = new Ext();
	return ext
}

function main(){
	init().enable();
}
