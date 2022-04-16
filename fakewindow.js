const Main = imports.ui.main;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");


class FakeWindow{
    constructor(extension, win){
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
    }

    bring_to_front (){}
    is_active (){
        return false;
    }
    activate (){}
    is_minimized (){
        return false;
    }
    
    is_maximized (){
        return false;
    }
    
    before_group (){}
    
    async after_group (keep_position){}
    
    minimize (){}
    
    maximize (){}
    
    unmaximize (){}
    
    unminimize (){}
    
    showing_on_its_workspace (){
        return true;
    }
    
    before_redraw (func){}
    
    on_move_to_workspace (workspace){}
    
    on_move_to_monitor (metaScreen, monitorIndex){}
    
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
    
    move_to_workspace (workspace){}
    
    move_to_monitor (idx){}
    
    get_min_size (){
        return {width: 0, height: 0};
    }

    move_resize (x, y, w, h){
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    resolve_promises (descending){}
    
    get_title (){
        return this.id();
    }
    toString (){
        return ("<#Window FakeWindow: " + this.get_title() + ">");
    }
    
    is_resizeable (){
        return true;
    }
    
    window_type (){
        return -1;
    }
    window_class (){
        return -1;
    }
    is_shown_on_taskbar (){
        return false;
    }
    floating_window (){
        return false;
    }
    on_all_workspaces (){
        return false;
    }
    should_auto_tile (){
        return true;
    }
    can_be_tiled (){
        return true;
    }
    
    id (){
        if (!this._id) this._id = "fake_window_" + FakeWindow.last_id++;
        return this._id;
    }
    
    eq (other){
        let eq = this.id() == other.id();
        if (eq && (this != other)){
            if (this.log.is_warn()) this.log.warn("Multiple wrappers for the same MetaWindow created: " + this);
        }
        return eq;
    }
    
    get_workspace (){
        if (this.original_win) return this.original_win.get_workspace();
    }
    
    get_actor (){
        return null;
    }
    
    has_real_window (){
        return !!this.original_win;
    }
    
    has_hole (){
        return true;
    }
    
    get_maximized_bounds (cursor){
        if (this.original_win){
            return this.original_win.get_maximized_bounds(cursor);
        }
    }
    
    maximize_size (){
        return null;
    }
    
    get_boundary_edges (group_size, current_size){
        return null;

    }
    
    get_modified_edges (saved_size, current_size){
        return null;

    }
    
    update_geometry (changed_position, changed_size){}
    
    raise (){}
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
        return this.outer_rect();
    }

    outer_rect (){
        return new Meta.Rectangle({
            x: this.x,
            y: this.y,
            width: this.w,
            height: this.h
        });
    }
    get_monitor (){
        return null;
    }
    
    clone (){
        return new FakeWindow();
    }
}

FakeWindow.last_id = 0;
