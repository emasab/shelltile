const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");

function Window(meta_window, ext) { this._init(meta_window, ext); }

// This seems to be a good set, from trial and error...
Window.tileable_window_types = [
	Meta.WindowType.NORMAL
];

// TODO: expose this as a preference if it gets used much
Window.blacklist_classes = [
	'Conky'
];

Window.prototype = {
	_init: function(meta_window, ext) {
		this._windowTracker = Shell.WindowTracker.get_default();
		this.meta_window = meta_window;
		this.extension = ext;
		this.log = Log.getLogger("Window");
	}

	,bring_to_front: function() {
		// NOOP (TODO: remove)
	}
	,is_active: function() {
		return this.ext.current_window() === this;
	}
	,activate: function() {
		Main.activateWindow(this.meta_window);
	}
	,is_minimized: function() {
		return this.meta_window.minimized;
	}
	
	,is_maximized: function(){
		return this.meta_window.maximized_horizontally || this.meta_window.maximized_vertically;	
	}
	
	,minimize: function() {
		this.meta_window.minimize();
	}
	
	,maximize: function(){
		this.meta_window.maximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
		var maximized_bounds = this.outer_rect();
		var monitor = this.get_monitor();
		var works = this.get_workspace();
	}
	
	,unmaximize: function(){
		this.meta_window.unmaximize(Meta.MaximizeFlags.VERTICAL | Meta.MaximizeFlags.HORIZONTAL);
	}
	
	,unminimize: function() {
		this.meta_window.unminimize();
	}
	
	,showing_on_its_workspace: function(){
		return this.meta_window.showing_on_its_workspace();
	}
	
	,before_redraw: function(func) {
		//TODO: idle seems to be the only LaterType that reliably works; but
		// it causes a visual flash. before_redraw would be better, but that
		// doesn't seem to be late enough in the layout cycle to move windows around
		// (which is what this hook is used for).
		Meta.later_add(
			Meta.LaterType.IDLE, //when
			func, //func
			null, //data
			null //notify
		)
	}
	
	,on_move_to_workspace: function(workspace) {
		
		delete this.marked_for_remove;
		
		if(this.group){
			this.group.move_to_workspace(workspace);
			var group = this.group.get_topmost_group();
			if(this.extension.keep_maximized){
				group.maximize_size();
			}
			group.raise();
			group.save_bounds();			
		}
	}
	
	,on_move_to_monitor: function(metaScreen, monitorIndex){
		delete this.marked_for_remove;
		if(this.group){
			this.update_geometry(true,false);
		}
	}
	
	,save_bounds: function(){
		this.save_position();
		this.save_size();
	}
	
	,save_position: function(){
		this.saved_position = this.outer_rect();
	}
	
	,save_size: function(){
		this.saved_size = this.outer_rect();
	}
	
	,move_to_workspace: function(workspace){
		if(!workspace) return;
		this.meta_window.change_workspace(workspace.meta_workspace);
		delete this.marked_for_remove;
	}
	
	,move_to_monitor: function(idx){
		this.meta_window.move_to_monitor(idx);
		delete this.marked_for_remove;
	}	
	
	,move_resize: function(x, y, w, h) {
		this.meta_window.move_resize_frame(true, x, y, w, h);
		if(this.is_maximized()){
			if(!this.saved_position) this.saved_position = {};
			if(!this.saved_size) this.saved_size = {};
			this.saved_position.x = x;
			this.saved_position.y = y;
			this.saved_size.width = w;
			this.saved_size.height = h;
		}
	}
	
	,get_title: function() {
		return this.meta_window.get_title();
	}
	,toString: function() {
		return ("<#Window with MetaWindow: " + this.get_title() + ">");
	}

	,is_resizeable: function() {
		return this.meta_window.resizeable;
	}
	
	,window_type: function() {
		try {
			return this.meta_window['window-type'];
		} catch (e) {
			//TODO: shouldn't be necessary
			if(this.log.is_error()) this.log.error("Failed to get window type for window " + this.meta_window + ", error was:", e);
			return -1;
		}
	}
	,window_class: function() {
		return this.meta_window.get_wm_class();
	}
	,is_shown_on_taskbar: function() {
		return !this.meta_window.is_skip_taskbar();
	}
	,floating_window: function() {
		//TODO: add check for this.meta_window.below when mutter exposes it as a property;
		return this.meta_window.above;
	}
	,on_all_workspaces: function() {
		return this.meta_window.is_on_all_workspaces();
	}
	,should_auto_tile: function() {
		return this.can_be_tiled() && this.is_resizeable() &&
			!(this.floating_window() || this.on_all_workspaces());
	}
	,can_be_tiled: function() {
		if(this.meta_window.is_skip_taskbar()) {
			if(this.log.is_debug()) this.log.debug("uninteresting window: " + this);
			return false;
		}
		var window_class = this.window_class();
		var blacklisted = Window.blacklist_classes.indexOf(window_class) != -1;
		if(blacklisted)
		{
			//if(this.log.is_debug()) this.log.debug("window class " + window_class + " is blacklisted");
			return false;
		}

		var window_type = this.window_type();
		var result = Window.tileable_window_types.indexOf(window_type) != -1;
		
		return result;
	}
	
	,id: function() {
		return Window.get_id(this.meta_window);
	}
	
	,eq: function(other) {
		let eq = this.id() == other.id();
		if(eq && (this != other)) {
			if(this.log.is_warn()) this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
		}
		return eq;
	}

	,get_workspace: function(){
		var meta_workspace = this.meta_window.get_workspace();
		if(meta_workspace){
			return this.extension.get_workspace(meta_workspace);
		} else return null;
	}
	
	,get_actor: function(){
		return this.meta_window.get_compositor_private();
	}

	,get_maximized_bounds: function(cursor){
		
		if(cursor) var monitor = Main.layoutManager.currentMonitor.index;
		else var monitor = Main.layoutManager.findMonitorForActor(this.get_actor()).index;
		if(Main.layoutManager && Main.layoutManager.getWorkAreaForMonitor) var ret =  Main.layoutManager.getWorkAreaForMonitor(monitor);
		else {
			// < 3.8
			var ret = global.gdk_screen.get_monitor_workarea(monitor);
		}
		
		return new Meta.Rectangle({ x: ret.x, y: ret.y, width: ret.width, height: ret.height});
	}
	
	,maximize_size: function(){
		var bounds = this.get_maximized_bounds();
		this.maximize();
		this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);
	}
	
	,get_boundary_edges: function(group_size, current_size){
		
		var ret = Window.NO_EDGES;
		
		if(Math.abs(current_size.x  - group_size.x) <= 1){
			
			ret |= Window.LEFT_EDGE;
			
		}
		
		if(Math.abs(current_size.y  - group_size.y) <= 1){
			
			ret |= Window.TOP_EDGE;
			
		}
		
		if(Math.abs( (current_size.x + current_size.width)  - (group_size.x + group_size.width) ) <= 1){
			
			ret |= Window.RIGHT_EDGE;
			
		}
		
		if(Math.abs( (current_size.y + current_size.height)  - (group_size.y + group_size.height) ) <= 1){
			
			ret |= Window.BOTTOM_EDGE;
			
		}

		return ret;		
		
	}
	
	,get_modified_edges: function(saved_size, current_size){
		
		var ret = Window.NO_EDGES;

		if(Math.abs(current_size.x  - saved_size.x) > 1){
			
			ret |= Window.LEFT_EDGE;
			
		}
		
		if(Math.abs(current_size.y  - saved_size.y) > 1){
			
			ret |= Window.TOP_EDGE;
			
		}
		
		if(Math.abs( (current_size.x + current_size.width)  - (saved_size.x + saved_size.width) ) > 1){
			
			ret |= Window.RIGHT_EDGE;
			
		}
		
		if(Math.abs( (current_size.y + current_size.height)  - (saved_size.y + saved_size.height) ) > 1){
			
			ret |= Window.BOTTOM_EDGE;
			
		}
		
		return ret;	
		
		
	}	
	
	,update_geometry: function(changed_position, changed_size){
		if(this.group){
			
			var same_size = true;

			if(!this.extension.keep_maximized){
				
				var group = this.group.get_topmost_group();
				//var group_size = group.outer_rect();
				var current_size = this.outer_rect();
				
				if(changed_size){
	
					var boundary_edges = this.get_boundary_edges(group.saved_size, this.saved_size);
					var modified_edges = this.get_modified_edges(this.saved_size, current_size);
					
					//if(this.log.is_debug()) this.log.debug("boundary_edges : " + boundary_edges);
					//if(this.log.is_debug()) this.log.debug("modified_edges: " + modified_edges);
					
					if((boundary_edges & modified_edges) > 0){

						var saved_size = group.saved_size;
						var saved_position = group.saved_position;
						
						if(boundary_edges & Window.RIGHT_EDGE || boundary_edges & Window.LEFT_EDGE){
							saved_size.width = saved_size.width + (current_size.width - this.saved_size.width);
						}
						if(boundary_edges & Window.BOTTOM_EDGE || boundary_edges & Window.TOP_EDGE){
							saved_size.height = saved_size.height + (current_size.height - this.saved_size.height);
						}
						if(boundary_edges & Window.TOP_EDGE){
							saved_position.y = current_size.y;
						}
						if(boundary_edges & Window.LEFT_EDGE){
							saved_position.x = current_size.x;
						}
						
						same_size = false;
					}
	
				}
				
				if(changed_position){
						
					var delta_x = (current_size.x - this.saved_position.x);
					var delta_y = (current_size.y - this.saved_position.y);
			
					group.saved_position.x += delta_x;
					group.saved_position.y += delta_y;
					same_size = false;
	
				}
			}
			
			
			if(same_size){
				this.group.update_geometry(this);
			} else {
				group.move_resize(group.saved_position.x, group.saved_position.y, group.saved_size.width,  group.saved_size.height);
				group.save_bounds();
				group.forget_last_bounds();
			}
			
		}
	}
	
	,raise: function(){
		if(this.marked_for_remove) return;
		this.unminimize();
		this.meta_window.raise();
	}
	
	// dimensions
	,width: function() { return this.outer_rect().width; }
	,height: function() { return this.outer_rect().height; }
	,xpos: function() { return this.outer_rect().x; }
	,ypos: function() { return this.outer_rect().y; }
	,outer_rect: function() { 
		if(this.is_maximized() && this.saved_size){
			var ret = this.saved_size;
			if(this.saved_position){
				ret.x = this.saved_position.x;
				ret.y = this.saved_position.y;
			}
			return ret;
		} else {
			if(this.meta_window.get_frame_rect) return this.meta_window.get_frame_rect();
			else {
				// removed in 3.16
				return this.meta_window.get_outer_rect();
			}
		}
	}
	,get_monitor: function() { return this.meta_window.get_monitor();}
};

Window.NO_EDGES = parseInt("0000",2)
Window.RIGHT_EDGE = parseInt("0001",2)
Window.BOTTOM_EDGE = parseInt("0010",2)
Window.LEFT_EDGE = parseInt("0100",2)
Window.TOP_EDGE = parseInt("1000",2)

Window.get_id = function(w) {
	if(!w || !w.get_stable_sequence) {
		Log.getLogger("shellshape.window").error("Non-window object: " + w);
	}
	return w.get_stable_sequence();
}
