const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");
const Window = Extension.imports.window.Window;
const FakeWindow = Extension.imports.fakewindow.FakeWindow;
const Compatibility = Extension.imports.util.Compatibility;
const Gdk = imports.gi.Gdk
const Config = imports.misc.config;
const Util = Extension.imports.util;
var version310 = Util.versionCompare(Config.PACKAGE_VERSION, "3.9") >= 0;

var WindowGroup = function (first, second, type, splitPercent){

    if (!splitPercent) splitPercent = 0.5;

    this.first = first;
    this.second = second;
    this.type = type
    this.splitPercent = splitPercent;
    this.log = Log.getLogger("WindowGroup");
    this.group = null;

    this.gap_between_windows = function (){
        let ret = this.extension.gap_between_windows;
        if (ret === undefined) ret = 10;
        return ret;
    }

    this.toString = function (){
        return "WindowGroup(first=" + this.first + ",second=" + this.second + ",type=" + this.type + ",splitPercent=" + this.splitPercent + ")";
    }

    this.id = function (){
        return "(" + this.first.id() + "," + this.second.id() + ")";
    }

    this.ids = function (){
        var ret = [];
        if (this.first.ids) ret = ret.concat(this.first.ids());
        else ret.push(this.first.id());

        if (this.second.ids) ret = ret.concat(this.second.ids());
        else ret.push(this.second.id());

        return ret;
    }

    this.has_real_window = function (){
        return true;
    }

    this.has_hole = function (){
        return this.first.has_hole() || this.second.has_hole();
    }

    this.get_maximized_bounds = function (cursor){
        if (this.first.has_real_window()) return this.first.get_maximized_bounds(cursor);
        else return this.second.get_maximized_bounds(cursor);
    }

    this.get_workspace = function (){
        if (this.first.has_real_window()) return this.first.get_workspace();
        else return this.second.get_workspace();
    }

    this.maximize_size = function (cursor){
        var bounds = this.get_maximized_bounds(cursor);
        this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    this.switch_maximized = function (){

        if (this._last_bounds){
            this.unmaximize();
        } else {
            this.maximize();
        }

    }

    this.maximize = function (){

        this.forget_last_bounds();
        this._last_bounds = this.outer_rect();
        this.maximize_size();
        this.save_bounds();
    }

    this.is_maximized = function (){
        return false;
    }

    this.unmaximize = function (){

        if (this._last_bounds){

            var bounds = this._last_bounds;
            this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);
            this.save_bounds();

        }
        this.forget_last_bounds();
    }

    this.forget_last_bounds = function (){
        if (this.first.forget_last_bounds) this.first.forget_last_bounds();
        if (this.second.forget_last_bounds) this.second.forget_last_bounds();

        if (this._last_bounds) delete this._last_bounds;
    }

    this.save_bounds = function (){
        this.save_position();
        this.save_size();
    }

    this.save_position = function (){
        this.saved_position = this.outer_rect();
        this.first.save_position();
        this.second.save_position();
    }

    this.save_size = function (){
        this.saved_size = this.outer_rect();
        this.first.save_size();
        this.second.save_size();
    }

    this.outer_rect = function (for_preview){
        var first_rect = this.first.outer_rect();
        var second_rect = this.second.outer_rect();
        if (for_preview){
            if (this.first.is_maximized()) return second_rect;
            else if (this.second.is_maximized()) return first_rect;
        }

        var xleft = first_rect.x < second_rect.x ? first_rect.x : second_rect.x;
        var yleft = first_rect.y < second_rect.y ? first_rect.y : second_rect.y;

        if ((first_rect.x + first_rect.width) > (second_rect.x + second_rect.width)){
            var xright = first_rect.x + first_rect.width;
        } else {
            var xright = second_rect.x + second_rect.width;
        }

        if ((first_rect.y + first_rect.height) > (second_rect.y + second_rect.height)){
            var yright = first_rect.y + first_rect.height;
        } else {
            var yright = second_rect.y + second_rect.height;
        }

        var x = xleft;
        var y = yleft;
        var width = xright - xleft;
        var height = yright - yleft;

        /*var maximized_bounds = this.get_maximized_bounds();
        if(x < maximized_bounds.x) x = maximized_bounds.x;
        if(y < maximized_bounds.y) y = maximized_bounds.y;
        if(width > maximized_bounds.width) width = maximized_bounds.width;
        if(height > maximized_bounds.width) height = maximized_bounds.height;*/

        return new Meta.Rectangle({
            x: x,
            y: y,
            width: width,
            height: height
        });
    }

    this.width = function (){
        return this.outer_rect().width;
    }
    this.height = function (){
        return this.outer_rect().height;
    }

    this.update_split_percent = function (bounds, changed){

        //if(this.log.is_debug()) this.log.debug("update_split_percent: " + [bounds.x, bounds.y, bounds.width, bounds.height]);

        var first_rect = this.first.outer_rect();
        var second_rect = this.second.outer_rect();
        var splitPercent = this.splitPercent;

        if (changed === this.first){

            if (this.type == WindowGroup.HORIZONTAL_GROUP){
                //if(this.log.is_debug()) this.log.debug("horizontal split changed");
                splitPercent = first_rect.width / bounds.width;

            } else if (this.type == WindowGroup.VERTICAL_GROUP){
                //if(this.log.is_debug()) this.log.debug("vertical split changed");
                splitPercent = first_rect.height / bounds.height;
            }
            this.splitPercent = splitPercent;

        } else if (changed === this.second){

            if (this.type == WindowGroup.HORIZONTAL_GROUP){
                //if(this.log.is_debug()) this.log.debug("horizontal split changed");
                splitPercent = 1 - ((second_rect.width + this.gap_between_windows()) / bounds.width);

            } else if (this.type == WindowGroup.VERTICAL_GROUP){
                //if(this.log.is_debug()) this.log.debug("vertical split changed");
                splitPercent = 1 - ((second_rect.height + this.gap_between_windows()) / bounds.height);
            }
            this.splitPercent = splitPercent;

        }
        if (this.group && !this.group.group && changed){
            var is_first = this.group.first === this
            var is_changed_first = this.first === changed;
            var other_side = is_first ? this.group.second : this.group.first;
            if (other_side.first){
                var sibling = is_changed_first ? other_side.first : other_side.second;
                var opposite = sibling === other_side.first ? other_side.second : other_side.first;
                if (!sibling.has_real_window() && opposite.has_real_window()){
                    other_side.splitPercent = this.splitPercent;
                }
            }
        }

    }

    this.update_geometry = function (win){

        if (win){

            var first_rect = this.first.outer_rect();
            var second_rect = this.second.outer_rect();
            var win_rect = win === this.first ? first_rect : second_rect;

            if (this.type == WindowGroup.HORIZONTAL_GROUP){

                var diff = (first_rect.x + first_rect.width + this.gap_between_windows()) - second_rect.x;

                if (win === this.first){

                    second_rect.x += diff;
                    second_rect.width -= diff;

                } else if (win === this.second){

                    first_rect.width -= diff;

                }

            } else if (this.type == WindowGroup.VERTICAL_GROUP){

                var diff = (first_rect.y + first_rect.height + this.gap_between_windows()) - second_rect.y;

                if (win === this.first){

                    second_rect.y += diff;
                    second_rect.height -= diff;

                } else if (win === this.second){
                    first_rect.height -= diff;
                }
            }

            this.first.move_resize(first_rect.x, first_rect.y, first_rect.width, first_rect.height);
            this.second.move_resize(second_rect.x, second_rect.y, second_rect.width, second_rect.height);

            var bounds = this.outer_rect();

            if (this.type == WindowGroup.HORIZONTAL_GROUP){
                bounds.height = win_rect.height;
                bounds.y = win_rect.y;
            } else if (this.type == WindowGroup.VERTICAL_GROUP){
                bounds.width = win_rect.width;
                bounds.x = win_rect.x;
            }


            this.update_split_percent(bounds, win);

            this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);

        }
        if (this.group) this.group.update_geometry(this);
        else {

            var saved_position = this.saved_position;
            var saved_size = this.saved_size;
            var bounds = this.outer_rect();

            if (saved_position){
                bounds.x = saved_position.x;
                bounds.y = saved_position.y;
            }

            if (saved_size){
                bounds.width = saved_size.width;
                bounds.height = saved_size.height;
            }

            this.move_resize(bounds.x, bounds.y, bounds.width, bounds.height);
        }
        var bounds = this.outer_rect();
        this.update_split_percent(bounds, win);

        if (this.splitPercent <= 0.05 && !this.first.has_real_window()){
            this.detach(this.first);
        } else if (this.splitPercent >= 0.95 && !this.second.has_real_window()){
            this.detach(this.second);
        }
    }

    this.move_resize = function (x, y, width, height){
        if (x === undefined || y === undefined || width === undefined || height === undefined){
            return;
        }

        let first_width = width;
        let second_width = width;
        let first_height = height;
        let second_height = height;
        let first_x = x;
        let second_x = x;
        let first_y = y;
        let second_y = y;

        //if(this.log.is_debug()) this.log.debug(this);

        if (this.type == WindowGroup.HORIZONTAL_GROUP){
            first_width = Math.round(width * this.splitPercent);
            second_width = width - first_width - this.gap_between_windows();
            second_x = first_x + first_width + this.gap_between_windows();

        } else if (this.type == WindowGroup.VERTICAL_GROUP){
            first_height = Math.round(height * this.splitPercent);
            second_height = height - first_height - this.gap_between_windows();
            second_y = first_y + first_height + this.gap_between_windows();
        }

        //if(this.log.is_debug()) this.log.debug("first: " + [first_x, first_y, first_width, first_height])
        this.first.move_resize(first_x, first_y, first_width, first_height);
        var first_rect = this.first.outer_rect();

        if (first_rect.width > first_width || first_rect.height > first_height){

            if (this.type == WindowGroup.HORIZONTAL_GROUP){
                if (first_rect.height > first_height){
                    second_height = first_rect.height;
                }
                if (first_rect.width > first_width){
                    var diff_w = first_rect.width - first_width;
                    second_x += diff_w;
                    second_width -= diff_w;
                }
            } else if (this.type == WindowGroup.VERTICAL_GROUP){
                if (first_rect.width > first_width){
                    second_width = first_rect.width;
                }
                if (first_rect.height > first_height){
                    var diff_h = first_rect.height - first_height;
                    second_y += diff_h;
                    second_height -= diff_h;
                }
            }
        }

        //if(this.log.is_debug()) this.log.debug("second: " + [second_x, second_y, second_width, second_height])
        this.second.move_resize(second_x, second_y, second_width, second_height);
        var second_rect = this.second.outer_rect();

        if (second_rect.width > second_width || second_rect.height > second_height){

            if (this.type == WindowGroup.HORIZONTAL_GROUP){
                if (second_rect.height > second_height){
                    first_height = second_rect.height;
                }
                if (second_rect.width > second_width){
                    var diff_w = second_rect.width - second_width;
                    first_width -= diff_w;
                    second_x -= diff_w;
                }
            } else if (this.type == WindowGroup.VERTICAL_GROUP){
                if (second_rect.width > second_width){
                    first_width = second_rect.width;
                }
                if (second_rect.height > second_height){
                    var diff_h = second_rect.height - second_height;
                    first_height -= diff_h;
                    second_y -= diff_h;
                }
            }

            //if(this.log.is_debug()) this.log.debug("first1: " + [first_x, first_y, first_width, first_height])
            this.first.move_resize(first_x, first_y, first_width, first_height);
            //if(this.log.is_debug()) this.log.debug("second1: " + [second_x, second_y, second_width, second_height])
            this.second.move_resize(second_x, second_y, second_width, second_height);
        }
    }

    this.move_to_workspace = function (workspace, descending){
        if (!descending && this.group){
            this.group.move_to_workspace(workspace);
        }

        if (this.first.meta_window && this.first.get_workspace() !== workspace){
            this.first.move_to_workspace(workspace);
        } else {
            this.first.move_to_workspace(workspace, true);
        }

        if (this.second.meta_window && this.second.get_workspace() !== workspace){
            this.second.move_to_workspace(workspace);
        } else {
            this.second.move_to_workspace(workspace, true);
        }
    }

    this.raise = function (ascending){
        if (this.group && ascending){
            this.group.raise(true);
        } else {
            if (!this.first.is_maximized()) this.first.raise();
            if (!this.second.is_maximized()) this.second.raise();
        }
    }

    this.get_windows = function (objects){
        var ret = [];
        if (this.first.get_windows){
            ret = ret.concat(this.first.get_windows(objects));
        } else {
            if (objects) ret.push(this.first);
            else ret.push(this.first.id());
        }

        if (this.second.get_windows){
            ret = ret.concat(this.second.get_windows(objects));
        } else {
            if (objects) ret.push(this.second);
            else ret.push(this.second.id());
        }
        return ret;
    }

    this.minimize = function (ascending){
        if (this.group && ascending){
            this.group.minimize(true);
        } else {
            if (!this.first.is_maximized()) this.first.minimize();
            if (!this.second.is_maximized()) this.second.minimize();
        }
    }

    this.unminimize = function (ascending){
        if (this.group && ascending){
            this.group.unminimize(true);
        } else {
            if (!this.first.is_maximized()) this.first.unminimize();
            if (!this.second.is_maximized()) this.second.unminimize();
        }
    }

    this.reposition = function (){

        var group = this.get_topmost_group();

        var existing_size = group.outer_rect();

        group.move_resize(existing_size.x, existing_size.y, existing_size.width, existing_size.height);

    }

    this.attach = function (win, replace, cursor){

        if (this.first.group){
            var withGroup = this.first;
        } else {
            var withGroup = this.second;
        }

        if (!this.extension.keep_maximized){
            var existing = this.first === win ? this.second : this.first;
            if (existing.group) existing = existing.group.get_topmost_group();
            var existing_size = existing.outer_rect();
        }

        var prevGroup = withGroup.group;
        if (prevGroup){
            if (prevGroup.first === withGroup){
                prevGroup.first = this;
            } else {
                prevGroup.second = this;
            }
            this.group = prevGroup;
        }

        this.first.group = this;
        this.second.group = this;

        if (replace){
            var to_detach = this.group.first === this ? this.group.second : this.group.first;
            this.group.detach(to_detach);
        }

        var group = this.get_topmost_group();

        if (this.extension.keep_maximized){

            group.maximize_size(cursor);

        } else {

            group.move_resize(existing_size.x, existing_size.y, existing_size.width, existing_size.height);

        }

        group.save_bounds();
        group.raise();


    }

    this.get_topmost_group = function (not_fake){
        var group = this;
        while (group.group){
            if (not_fake){
                if (!group.group.first.has_real_window() || !group.group.second.has_real_window()) break;
            }
            group = group.group;
        }
        return group;
    }


    this.get_first_non_fake_window = function (){
        var curr = this;
        while (true){
            if (!curr.get_first_non_fake_window) break;
            if (!curr.first.has_real_window()){
                curr = curr.second;
            } else if (!curr.second.has_real_window()){
                curr = curr.first;
            } else break;
        }
        return curr;
    }

    this.detach = function (win, noop, replace_with){
        var other = this.first === win ? this.second : this.first;
        if (other && !other.has_real_window()) replace_with = null;

        if (replace_with){
            if (this.first === win){
                delete this.first.group;
                this.first = replace_with;
            } else {
                delete this.second.group;
                this.second = replace_with;
            }
            replace_with.group = this;
            if (!noop){
                var group = this.get_topmost_group();
                group.update_geometry();
            }
        } else if (this.group){

            if (this.group.first === this){
                if (this.first === win){
                    this.group.first = this.second;
                    this.second.group = this.group;
                } else {
                    this.group.first = this.first;
                    this.first.group = this.group;
                }
            } else if (this.group.second === this){
                if (this.first === win){
                    this.group.second = this.second;
                    this.second.group = this.group;
                } else {
                    this.group.second = this.first;
                    this.first.group = this.group;
                }
            }

            delete win.group;
            if (!noop){
                var group = this.get_topmost_group();
                group.update_geometry();
            }
            delete this.group;
            delete this.first;
            delete this.second;

        } else {

            delete this.first.group;
            delete this.second.group;

            if (!noop && this.extension.keep_maximized){
                var maxi = this.first;
                if (win === this.first) maxi = this.second;

                maxi.maximize_size();
                maxi.save_bounds();
            }
            delete this.first;
            delete this.second;
        }
    }

    this.preview_rect = function (win, cursor_rect){
        var preview = [
            [0, 0, 1, 0.5],
            [0.5, 0, 0.5, 1],
            [0, 0.5, 1, 0.5],
            [0, 0, 0.5, 1]
        ]
        var perc = this.splitPercent;

        if (win === this.first){
            var corner = this.type == WindowGroup.VERTICAL_GROUP ? 0 : 3;
            var win_rect = this.second.outer_rect();

        } else if (win === this.second){
            var corner = this.type == WindowGroup.VERTICAL_GROUP ? 2 : 1;
            var win_rect = this.first.outer_rect();
        }

        var currentpreview = preview[corner].slice();
        if (corner == 0){
            currentpreview[3] = perc;
        } else if (corner == 1){
            currentpreview[0] = perc;
            currentpreview[2] = 1 - perc;
        } else if (corner == 2){
            currentpreview[1] = perc;
            currentpreview[3] = 1 - perc;
        } else if (corner == 3){
            currentpreview[2] = perc;
        }

        var preview_x = win_rect.x + currentpreview[0] * win_rect.width;
        var preview_y = win_rect.y + currentpreview[1] * win_rect.height;
        var preview_width = currentpreview[2] * win_rect.width;
        var preview_height = currentpreview[3] * win_rect.height;

        return new Meta.Rectangle({
            x: preview_x,
            y: preview_y,
            width: preview_width,
            height: preview_height
        });
    }

    this.top_left_window = function (){
        if (this.type == WindowGroup.HORIZONTAL_GROUP){
            if (this.first.top_left_window) return this.first.top_left_window();
            else if (this.first.has_real_window()) return this.first;
            else if (this.second.top_left_window) return this.second.top_left_window();
            else return this.second;
        } else {
            if (this.first.top_left_window) return this.first.top_left_window();
            else if (this.first.has_real_window()) return this.first;
            else if (this.second.top_left_window) return this.second.top_left_window();
            else return this.second;
        }
    }

    this.clone = function (cursor){
        if (!this.first.first){
            var first = new FakeWindow(this.extension, this.first.has_real_window() ? this.first : undefined);
        } else var first = this.first.clone(cursor);
        if (!this.second.first){
            var second = new FakeWindow(this.extension, this.second.has_real_window() ? this.second : undefined);
        } else var second = this.second.clone(cursor);

        var ret = new WindowGroup(first, second, this.type, this.splitPercent);
        ret.extension = this.extension;
        ret.attach(undefined, undefined, cursor);
        return ret;
    }
}
WindowGroup.HORIZONTAL_GROUP = "horizontal";
WindowGroup.VERTICAL_GROUP = "vertical";
WindowGroup.calc_split_percent = function (win_rect, cursor_rect, corner, type, num, tot, log){
    if (corner == 0) var percwidth = cursor_rect.y - (win_rect.y + num / tot * 0.5 * win_rect.height);
    else if (corner == 1) var percwidth = cursor_rect.x - (win_rect.x + 0.5 * win_rect.width + (tot - num - 1) / tot * 0.5 * win_rect.width);
    else if (corner == 2) var percwidth = cursor_rect.y - (win_rect.y + 0.5 * win_rect.height + (tot - num - 1) / tot * 0.5 * win_rect.height);
    else if (corner == 3) var percwidth = cursor_rect.x - (win_rect.x + num / tot * 0.5 * win_rect.width);
    var perc = type == WindowGroup.VERTICAL_GROUP ? percwidth / win_rect.height * 2 * tot : percwidth / win_rect.width * 2 * tot;
    if (perc > 0.999) perc = 0.999;
    if (perc < 0.001) perc = 0.001;
    return perc;
}

WindowGroup.find_cloned_child = function (original, clone, child_to_find){
    if (original === child_to_find) return clone;
    else if (original.first){
        var ret = WindowGroup.find_cloned_child(original.first, clone.first, child_to_find);
        if (ret) return ret;
        var ret = WindowGroup.find_cloned_child(original.second, clone.second, child_to_find);
        if (ret) return ret;
    }
}


var DefaultTilingStrategy = function (ext){

    this.extension = ext;
    this.log = Log.getLogger("DefaultTilingStrategy");
    this.lastTime = null;
    this.lastTimeCtrlPressed = null;
    this.lastTimeShiftPressed = null;

    this.preview = new St.BoxLayout({
        style_class: 'tile-preview'
    });
    this.preview_for_edge_tiling = false;
    this.preview.visible = false;
    Main.uiGroup.add_actor(this.preview);
    var default_modifier = Gdk.Keymap.get_default();



    this.is_ctrl_pressed = function (){
        //this.log.debug("Modifier key: " + this.extension.tile_modifier_key);
        var modifiers = Clutter.ModifierType.CONTROL_MASK; // Default: Ctrl only
        if (this.extension.tile_modifier_key === 'Super')
            modifiers = Clutter.ModifierType.MOD4_MASK;
        if (this.extension.tile_modifier_key === 'Ctrl or Super')
            modifiers = modifiers | Clutter.ModifierType.MOD4_MASK;
        var ret = default_modifier.get_modifier_state() & modifiers;

        if (ret){
            this.lastTimeCtrlPressed = new Date().getTime();
        } else {
            var currTime = new Date().getTime();
            if (this.lastTimeCtrlPressed && (currTime - this.lastTimeCtrlPressed) < 500){
                ret = true;
            }
        }
        return ret;
    }

    this.is_shift_pressed = function (){
        let [x, y, mods] = global.get_pointer();
        var ret = mods & Clutter.ModifierType.SHIFT_MASK;
        if (ret){
            this.lastTimeShiftPressed = new Date().getTime();
        } else {
            var currTime = new Date().getTime();
            if (this.lastTimeShiftPressed && (currTime - this.lastTimeShiftPressed) < 500){
                ret = true;
            }
        }
        return ret;
    }

    this.check_after_move = function (moving){
        if (this._check_after_move){
            //if(this.log.is_debug()) this.log.debug("check after move");
            for (var i = 0; i < this._check_after_move.length; i++){
                var c = this._check_after_move[i];
                //if(this.log.is_debug()) this.log.debug("check after move1");
                if (!c.group && c.after_group) c.after_group(c === moving);
            }
            delete this._check_after_move;
        }
    }

    this.on_window_move = function (win){
        //if(!win._dragging) return;
        //win.unmaximize();
        win.raise();

        var currTime = new Date().getTime();
        var interval = 200
        if (!this.lastTime || (currTime - this.lastTime) > interval){

            var is_ctrl_pressed = !!this.is_ctrl_pressed();
            var detach_window = is_ctrl_pressed != !!this.extension.keep_maximized;

            if (!win.group){

                this.lastTime = currTime;

                var preview_rect = null;

                if (win && is_ctrl_pressed){

                    var window_under = this.get_window_under(win);
                    if (window_under){

                        var groupPreview = this.get_window_group_preview(window_under, win);
                        if (groupPreview){
                            var preview_rect = groupPreview.preview_rect(win, this.get_cursor_rect());
                            groupPreview.first = null;
                            groupPreview.second = null;
                            //if(this.log.is_debug()) this.log.debug("preview_rect: " + preview_rect);
                        }

                    }

                }

                var for_edge_tiling = !preview_rect;
                if (for_edge_tiling){

                    var preview_rect = this.get_edge_preview(win);
                }

                this.preview_for_edge_tiling = for_edge_tiling;
                this.update_preview(preview_rect);

            } else if (win.group && detach_window && win.has_moved_enough_for_detach()){

                this.extension._automatic_change = true;
                if (!this._check_after_move) this._check_after_move = [];
                this._check_after_move = this._check_after_move.concat([win.group.first, win.group.second]);
                this.detach_window(win);
                win.raise();
                delete this.extension._automatic_change;

            }

        } else {

            if (!this.__timeout){
                var me = this;
                var remaining = this.lastTime + interval - currTime + 10;

                me.__timeout = Mainloop.timeout_add(remaining, function (){
                    delete me.__timeout;
                    me.on_window_move(win);

                });

            }

        }
    }

    this.on_window_moved = function (win){

        if (this.__timeout){
            Mainloop.source_remove(this.__timeout);
            delete this.__timeout;
        }

        if (win.group){
            win.update_geometry(true, false);
            win.raise();
        } else {

            var is_ctrl_pressed = this.is_ctrl_pressed();
            var window_under = null;
            var group_preview = null;

            if (is_ctrl_pressed || (!this.preview_for_edge_tiling && this.preview.visible)){

                var window_under = this.get_window_under(win);
                if (window_under){

                    var group_preview = this.get_window_group_preview(window_under, win);

                }

            }

            if (group_preview){

                if (win.group) win.group.detach(win);
                else {
                    win.before_group();
                    window_under.before_group();
                }

                var is_maximized = window_under.is_maximized();
                window_under.unmaximize();
                group_preview.attach(win);
                if (is_maximized){
                    var topmost = group_preview.get_topmost_group();
                    topmost.maximize_size();
                }

            } else {

                var preview_rect = this.get_edge_preview(win, undefined, true);
                if (preview_rect){
                    if (!preview_rect.type){
                        if (preview_rect.maximize) win.maximize();
                        else win.move_resize(preview_rect.x, preview_rect.y, preview_rect.width, preview_rect.height);
                    }
                } else if(win.has_moved_enough_for_detach()){
                    this.check_after_move(win);
                }

            }
        }
        this.update_preview(null);

    }

    this.on_accelerator = function (accel){
        var meta_window = Compatibility.get_display().focus_window;
        if (!meta_window) return;

        var me = this;
        var hasLastCode = !!me.lastCode;
        var win = this.extension.get_window(meta_window, true);
        var preview_rect = this.get_edge_preview(win, accel);

        var apply = function (preview_rect){
            if (preview_rect.maximize) win.maximize();
            else {
                if (win.group){
                    win.group.detach(win);
                }
                win.unmaximize();
                win.move_resize(preview_rect.x, preview_rect.y, preview_rect.width, preview_rect.height);
            }
        }

        if (preview_rect){

            if (!me.__accelerator_timeout){

                me.__accelerator_timeout = Mainloop.timeout_add(DefaultTilingStrategy.ACCELERATOR_TIMEOUT + 10, function (){
                    if (!me.__accelerator_timeout) return;
                    apply(preview_rect);
                    Mainloop.source_remove(me.__accelerator_timeout);
                    delete me.__accelerator_timeout;
                });

            } else if (hasLastCode){

                Mainloop.source_remove(me.__accelerator_timeout);
                delete me.__accelerator_timeout;
                apply(preview_rect);

            }

        }
    }

    this.update_preview = function (preview_rect){



        if (preview_rect){

            if (!this.last_preview_rect || !this.last_preview_rect.equal(preview_rect)){

                this.preview.visible = true;

                Tweener.removeTweens(this.preview);
                Tweener.addTween(this.preview, {
                    time: 0.125,
                    opacity: 255,
                    visible: true,
                    transition: 'easeOutQuad',
                    x: preview_rect.x,
                    y: preview_rect.y,
                    width: preview_rect.width,
                    height: preview_rect.height
                });

                /*this.preview.x = preview_rect.x;
                this.preview.y = preview_rect.y;
                this.preview.width = preview_rect.width;
                this.preview.height = preview_rect.height;*/
            } else {

                //if(this.log.is_debug()) this.log.debug("same rect");

            }

        } else {
            Tweener.removeTweens(this.preview);
            this.preview.visible = false;
        }
        this.last_preview_rect = preview_rect;
    }

    this.on_window_resize = function (win){
        win.raise();

        /*
        * not yet, causees flickering on some types of windows like nautilus

        var currTime = new Date().getTime();
        if(!this.lastTime || (currTime - this.lastTime) > 200){

            if(win.group){

                this.lastTime = currTime;
                win.update_geometry(false, true);

            }

        } else {

            if(!this.__timeout){
                var me = this;

                var remaining = this.lastTime + 200 - currTime + 10;

                me.__timeout = Mainloop.timeout_add(remaining, function(){

                    me.on_window_resize(win);
                    delete me.__timeout;

                });

            }

        }
        */
    }

    this.on_window_resized = function (win){
        win.update_geometry(false, true);
        this.on_window_resize(win);
    }

    this.on_window_maximize = function (win){
        if (win.group){

            var ctrl_pressed = this.is_ctrl_pressed();

            if (ctrl_pressed){

                if (this.is_shift_pressed()){

                    var topmost_group = win.group.get_topmost_group();
                    win.unmaximize();
                    topmost_group.switch_maximized();

                }

            } else {

                win.check_after = true;
                this.detach_window(win);
                //if(this.extension.keep_maximized) win.maximize_size();

            }
            win.raise();

        }
    }

    this.on_window_unmaximize = function (win){
        Mainloop.idle_add(Lang.bind(this, function(){
            if (win.group){
                var topmost_group = win.group.get_topmost_group();
                topmost_group.unminimize(true);
                topmost_group.reposition();
            } else {
                if (win.check_after){
                    delete win.check_after;
                    win.after_group();
                }
            }
        }));
    }

    this.detach_window = function (win){
        if (win.group){
            var other = null;
            if (!win.group.group){
                var other = win === win.group.first ? win.group.second : win.group.first;
            }
            var replacement = new FakeWindow(this.extension);

            if (win.group.group && win.group.group.group) replacement = null;
            if (win.group.group && win.group.type == win.group.group.type) replacement = null;

            win.group.detach(win, undefined, replacement);
            if (!replacement && other && other.after_group){
                other.after_group();
            }
        }
    }

    this.on_window_remove = function (win){
        if (win.marked_for_remove){
            //if(this.log.is_debug()) this.log.debug("detach window");
            this.detach_window(win);
        }
    }

    this.on_window_minimize = function (win){
        if (win.group && !win.is_maximized()){
            win.group.minimize(true);
        }
    }

    this.on_window_raised = function (win){
        //if(this.log.is_debug()) this.log.debug("raised:" + win.id());
        if (win.group && !win.is_maximized()){
            win.group.raise(true);
            win.raise();
        }
    }

    this.get_window_group_preview = function (below, above){

        var log = this.log;

        let TOP_LEFT = 0;
        let TOP_RIGHT = 1;
        let BOTTOM_RIGHT = 2;
        let BOTTOM_LEFT = 3;

        var current = below;
        var corners = [
            [],
            [],
            [],
            []
        ];
        corners[TOP_LEFT].push(current);
        corners[TOP_RIGHT].push(current);
        corners[BOTTOM_RIGHT].push(current);
        corners[BOTTOM_LEFT].push(current);

        var delta = [
            [0, 1, 0, -1],
            [0, 0, -1, 0],
            [0, 0, 0, -1],
            [1, 0, -1, 0]
        ];
        var start = [
            [0, 0],
            [0.5, 0],
            [0.5, 0.5],
            [0, 0.5]
        ];
        var groups = [
            ["above", "below", "v"],
            ["below", "above", "h"],
            ["below", "above", "v"],
            ["above", "below", "h"]
        ];

        let exclude = {};

        while (current.group){
            var parent = current.group;

            var is_first = parent.first === current;
            var sibling = is_first ? parent.second : parent.first;
            if (sibling.has_hole()) break;

            if (parent.type == WindowGroup.HORIZONTAL_GROUP){

                if (!exclude[TOP_LEFT]) corners[TOP_LEFT].push(parent);
                if (!exclude[BOTTOM_RIGHT]) corners[BOTTOM_RIGHT].push(parent);

                if (is_first){
                    exclude[TOP_RIGHT] = true;
                    exclude[BOTTOM_RIGHT] = true;
                } else {
                    exclude[TOP_LEFT] = true;
                    exclude[BOTTOM_LEFT] = true;
                }

            } else if (parent.type == WindowGroup.VERTICAL_GROUP){


                if (!exclude[TOP_RIGHT]) corners[TOP_RIGHT].push(parent);
                if (!exclude[BOTTOM_LEFT]) corners[BOTTOM_LEFT].push(parent);

                if (is_first){
                    exclude[BOTTOM_LEFT] = true;
                    exclude[BOTTOM_RIGHT] = true;
                } else {
                    exclude[TOP_LEFT] = true;
                    exclude[TOP_RIGHT] = true;
                }
            }
            current = parent;
        }

        var calculate_corners = function (below_rect, currentcorner, currentdelta, currentstart, corner){

            var current_x = below_rect.x + below_rect.width * currentstart[0];
            var current_y = below_rect.y + below_rect.height * currentstart[1];
            var current_width = below_rect.width / 2;
            var current_height = below_rect.height / 2;

            var delta_w = current_width / currentcorner.length;
            var delta_h = current_height / currentcorner.length;

            var ret = [];
            for (var i = 0; i < currentcorner.length; i++){
                var win = currentcorner[i];

                var corner_x = current_x;
                var corner_y = current_y;
                var corner_width = current_width;
                var corner_height = current_height;

                var corner_rect = new Meta.Rectangle({
                    x: corner_x,
                    y: corner_y,
                    width: corner_width,
                    height: corner_height
                });
                ret.splice(0, 0, [corner_rect, win, corner]);

                current_x += currentdelta[0] * delta_w;
                current_y += currentdelta[1] * delta_h;
                current_width += currentdelta[2] * delta_w;
                current_height += currentdelta[3] * delta_h;
            }
            return ret;
        }

        var below_rect = below.outer_rect();

        var corner_rects = [];
        for (var i = 0; i < 4; i++){
            var currentcorner = corners[i];
            var currentdelta = delta[i];
            var currentstart = start[i];
            corner_rects[i] = calculate_corners(below_rect, currentcorner, currentdelta, currentstart, i);
        }

        var cursor_rect = this.get_cursor_rect();
        var current_corner = null;
        var current_nums = 0;
        var current_tot = 2;


        var me = this;
        var get_current_cursor_rect = function (){

            for (var i = 0; i < corner_rects.length; i++){

                var current_corner_rects = corner_rects[i];
                for (var j = 0; j < current_corner_rects.length; j++){
                    var current_corner_rect = current_corner_rects[j];
                    current_tot = current_corner_rects.length;
                    if (current_corner_rect[0].contains_rect(cursor_rect)){
                        current_corner = i;
                        current_nums = current_corner_rects.length - j - 1;
                        return current_corner_rect;
                    }
                }
            }
            return null;
        }


        var current_cursor_rect = get_current_cursor_rect();
        if (!current_cursor_rect) return null;
        else {
            var win = current_cursor_rect[1];
            var group = groups[current_cursor_rect[2]];

            var vars = {
                "above": above,
                "below": win,
                "h": WindowGroup.HORIZONTAL_GROUP,
                "v": WindowGroup.VERTICAL_GROUP
            };

            if (this.extension.mouse_split_percent){
                var perc = WindowGroup.calc_split_percent(below.outer_rect(), cursor_rect, current_corner, vars[group[2]], current_nums, current_tot, me.log);
            } else {
                var perc = 0.5;
            }
            var ret = new WindowGroup(vars[group[0]], vars[group[1]], vars[group[2]], perc);
            ret.extension = this.extension;
            return ret;
        }
    }

    this.get_cursor_rect = function (){
        let [mouseX, mouseY] = global.get_pointer();
        return new Meta.Rectangle({
            x: mouseX,
            y: mouseY,
            width: 1,
            height: 1
        });
    }

    this.get_cursor_monitor = function (){
        return Main.layoutManager.currentMonitor.index;
    }

    this.get_window_under = function (win, include_fakes){
        var workspace = win.get_workspace();
        var workspace_windows = workspace.meta_windows();

        var cursor_rect = this.get_cursor_rect();
        var cursor_monitor = this.get_cursor_monitor();
        //if(this.log.is_debug()) this.log.debug("cursor_monitor: " + cursor_monitor);

        var topmost = undefined;
        var current_group = undefined;
        var current_windows = undefined;
        var current_windows_obj = undefined;
        var log = this.log;

        for (let i = workspace_windows.length - 1; i >= 0; i--){
            let win1 = workspace_windows[i];
            let win1_monitor = win1.get_monitor();
            //if(this.log.is_debug()) this.log.debug("win1_monitor: " + win1_monitor);
            if (win1_monitor != cursor_monitor) continue;

            win1 = this.extension.get_window(win1, true);
            //if(this.log.is_debug()) this.log.debug("window_under: " + win1);
            if (win1.can_be_tiled() && !win1.is_minimized() && win1.id() != win.id()){

                if (win1.outer_rect().contains_rect(cursor_rect)){

                    topmost = win1;
                    break;
                } else {
                    if (!current_group && win1.group){

                        current_group = win1.group.get_topmost_group();
                        current_windows = current_group.get_windows();
                        current_windows_obj = current_group.get_windows(true);
                        var idx = current_windows.indexOf(win.id());
                        if (idx >= 0) current_windows.splice(idx, 1);

                    }
                    if (current_windows){
                        var idx = current_windows.indexOf(win1.id());
                        if (idx >= 0){
                            current_windows.splice(idx, 1);
                            current_windows_obj.splice(idx, 1);
                        }

                        //if(this.log.is_debug()) this.log.debug("current_windows: " + current_windows);
                        if (current_windows.length == 0){
                            if (current_group.outer_rect().contains_rect(cursor_rect)){
                                break
                            }
                            current_group = undefined;
                            current_windows = undefined;
                            current_windows_obj = undefined;
                        } else if (include_fakes){
                            var maxi = win.get_maximized_bounds();
                            if (cursor_rect.x < maxi.x) cursor_rect.x = maxi.x;
                            if (cursor_rect.x > maxi.x + maxi.width) cursor_rect.x = maxi.x + maxi.width;
                            if (cursor_rect.y < maxi.y) cursor_rect.y = maxi.y;
                            if (cursor_rect.y > maxi.y + maxi.height) cursor_rect.y = maxi.y + maxi.height;

                            current_windows_obj.forEach(function (w1){
                                if (w1.outer_rect().contains_rect(cursor_rect)){
                                    topmost = w1;
                                    return false;
                                }
                            });
                            if (topmost) break;
                        }
                    }
                }

            }
        }
        return topmost;
    }

    this.get_edge_tiling = function (win, position, preview){

        var window_under = this.get_window_under(win, true);

        if (preview){
            win = new FakeWindow(this.extension, win);
        }

        var perc = 0.5;
        win.before_group();

        if (preview && window_under){
            if (window_under.group){
                var topmost_group = window_under.group.get_topmost_group();
                var topmost_group_clone = topmost_group.clone(true);
                topmost_group_clone.update_geometry();
                //if(this.log.is_debug()) this.log.debug("topmost_group_clone " + topmost_group_clone);
                window_under = WindowGroup.find_cloned_child(topmost_group, topmost_group_clone, window_under);
            }
        }

        if (window_under && !window_under.has_real_window()){
            var newgroup = null;
            var is_top_or_bottom = (position.is_top || position.is_bottom) && !position.is_left && !position.is_right;
            var is_left_or_right = (position.is_left || position.is_right) && !position.is_top && !position.is_bottom;

            var top_group = window_under.group.group || window_under.group;
            var top_window_under = window_under.group.group ? window_under.group : window_under;
            if (top_group){
                var other_side = top_group.first === top_window_under ? top_group.second : top_group.first;
                var is_other_side_first = other_side === top_group.first;

                var rotate_half_screen = is_top_or_bottom && top_group.type == WindowGroup.HORIZONTAL_GROUP ||
                    is_left_or_right && top_group.type == WindowGroup.VERTICAL_GROUP;

                rotate_half_screen = rotate_half_screen && (!other_side.has_real_window() || other_side.first) &&
                    (

                        (position.is_top && other_side.first && other_side.second.has_real_window() && !other_side.first.has_real_window() ||
                            position.is_top && top_window_under.first && top_window_under.second.has_real_window())

                        ||

                        (position.is_bottom && other_side.first && other_side.first.has_real_window() && !other_side.second.has_real_window() ||
                            position.is_bottom && top_window_under.first && top_window_under.first.has_real_window())

                        ||

                        (position.is_left && other_side.first && other_side.second.has_real_window() && !other_side.first.has_real_window() ||
                            position.is_left && top_window_under.first && top_window_under.second.has_real_window())

                        ||

                        (position.is_right && other_side.first && other_side.first.has_real_window() && !other_side.second.has_real_window() ||
                            position.is_right && top_window_under.first && top_window_under.first.has_real_window())

                    );


                rotate_half_screen = rotate_half_screen && (!top_window_under.splitPercent ||
                    !other_side.splitPercent ||
                    Math.abs(top_window_under.splitPercent - other_side.splitPercent) < 0.05);


                var other_side = top_group.first === top_window_under ? top_group.second : top_group.first;
                var other_side_first = other_side === top_group.first;
                var sibling_window = null;
                var opposite_window = null;

                if (other_side.splitPercent && !window_under.group.group && !is_top_or_bottom && !is_left_or_right){
                    if (other_side_first && other_side.first.has_real_window() && (position.is_right && position.is_top || position.is_left && position.is_bottom)){
                        var sibling_window = other_side.first;
                        var opposite_window = other_side.second;
                    }
                    if (other_side_first && other_side.second.has_real_window() && (position.is_bottom && position.is_right)){
                        var sibling_window = other_side.second;
                        var opposite_window = other_side.first;
                    }
                    if (!other_side_first && other_side.first.has_real_window() && (position.is_left && position.is_top)){
                        var sibling_window = other_side.first;
                        var opposite_window = other_side.second;
                    }
                    if (!other_side_first && other_side.second.has_real_window() && (position.is_right && position.is_top || position.is_left && position.is_bottom)){
                        var sibling_window = other_side.second;
                        var opposite_window = other_side.first;
                    }
                }

                if (sibling_window && !opposite_window.has_real_window()){

                    opposite_window.group.detach(opposite_window);
                    var new_type = top_group.type == WindowGroup.HORIZONTAL_GROUP ? WindowGroup.VERTICAL_GROUP : WindowGroup.HORIZONTAL_GROUP;
                    if (new_type == WindowGroup.VERTICAL_GROUP && position.is_top ||
                        new_type == WindowGroup.HORIZONTAL_GROUP && position.is_left){
                        var first = top_group;
                        var second = opposite_window;
                    } else {
                        var first = opposite_window;
                        var second = top_group;
                    }

                    newgroup = new WindowGroup(first, second, new_type, other_side.splitPercent);
                    newgroup.extension = this.extension;
                    newgroup.attach(undefined, undefined, true);

                } else if (rotate_half_screen){

                    var top_group_splitPercent = top_group.splitPercent;
                    var top_group_type = top_group.type;
                    var other_side_first = other_side.first;
                    var other_side_second = other_side.second;
                    var other_side_splitPercent = other_side.splitPercent;
                    var top_window_under_splitPercent = top_window_under.splitPercent;
                    var top_window_under_first = top_window_under.first;
                    var top_window_under_second = top_window_under.second;


                    var newgroup_other_side_one = other_side_first ? (other_side_first.has_real_window() ? other_side_first : other_side.second) : other_side;
                    var newgroup_other_side_two = top_window_under_first && top_window_under_first.has_real_window() ? top_window_under_first :
                        top_window_under_second && top_window_under_second.has_real_window() ? top_window_under_second : null;

                    if (!newgroup_other_side_two){
                        newgroup_other_side_two = new FakeWindow(this.extension);
                    }

                    var newgroup_other_side_first = is_other_side_first ? newgroup_other_side_one : newgroup_other_side_two;
                    var newgroup_other_side_second = is_other_side_first ? newgroup_other_side_two : newgroup_other_side_one;

                    if (other_side_first) other_side.detach(other_side_first, true);
                    else if (other_side_second) other_side.detach(other_side_second, true);
                    if (top_window_under_first) top_window_under.detach(top_window_under_first, true);
                    else if (top_window_under_second) top_window_under.detach(top_window_under_second, true);
                    top_group.detach(other_side, true);

                    var newgroup_other_side = new WindowGroup(newgroup_other_side_first, newgroup_other_side_second, top_group_type, top_group_splitPercent);
                    newgroup_other_side.extension = this.extension;
                    newgroup_other_side.attach(undefined, undefined, true);

                    var window_one = window_under;
                    var window_two = newgroup_other_side;
                    var first = position.is_top || position.is_left ? window_one : window_two;
                    var second = first === window_one ? window_two : window_one;
                    var new_type = top_group_type == WindowGroup.HORIZONTAL_GROUP ? WindowGroup.VERTICAL_GROUP : WindowGroup.HORIZONTAL_GROUP;

                    newgroup = new WindowGroup(first, second, new_type, top_window_under_splitPercent || other_side_splitPercent);
                    newgroup.extension = this.extension;
                    newgroup.attach(undefined, undefined, true);

                }
            }

            if (!window_under.group.group && (position.is_top || position.is_bottom) && (position.is_left || position.is_right)){

                // creates new division for corner tiling

                var other_side = window_under.group.first === window_under ? window_under.group.second : window_under.group.first;
                var splitPercent = other_side.splitPercent ? other_side.splitPercent : perc;
                var new_type = null;

                if (window_under.group.type == WindowGroup.VERTICAL_GROUP){
                    var first = position.is_left ? win : window_under;
                    var second = first === win ? window_under : win;
                    new_type = WindowGroup.HORIZONTAL_GROUP;
                } else {
                    var first = position.is_top ? win : window_under;
                    var second = first === win ? window_under : win;
                    new_type = WindowGroup.VERTICAL_GROUP;
                }

                newgroup = new WindowGroup(first, second, new_type, splitPercent);
                newgroup.extension = this.extension;
                newgroup.attach(win, undefined, true);

            } else if (window_under.group &&
                !(window_under.group.group && (is_top_or_bottom || is_left_or_right)) &&
                !(window_under.group.type == WindowGroup.VERTICAL_GROUP && is_left_or_right) &&
                !(window_under.group.type == WindowGroup.HORIZONTAL_GROUP && is_top_or_bottom)
            ){

                // replace fake window under

                var first = window_under.group.first === window_under ? win : window_under.group.first;
                var second = first === win ? window_under.group.second : win;

                newgroup = new WindowGroup(first, second, window_under.group.type, window_under.group.splitPercent);
                newgroup.extension = this.extension;
                newgroup.attach(win, true, true);



            }

            if (newgroup){
                //newgroup.maximize_size();
                return preview ? win : newgroup.get_topmost_group();
            }
        }

        var orig_win = win;
        while (position.is_left || position.is_right || position.is_top || position.is_bottom){
            var first = win;
            var second = new FakeWindow(this.extension);
            var group_type = WindowGroup.HORIZONTAL_GROUP;

            if (position.is_top || position.is_bottom){

                if (position.is_bottom){
                    var app = second;
                    second = first;
                    first = app;
                }

                position.is_top = false;
                position.is_bottom = false;
                group_type = WindowGroup.VERTICAL_GROUP;

            } else {

                if (position.is_right){
                    var app = second;
                    second = first;
                    first = app;
                }

                position.is_left = false;
                position.is_right = false;
            }

            var group = new WindowGroup(first, second, group_type, perc);
            group.extension = this.extension;
            group.attach(win, undefined, true);
            win = group;
        }
        orig_win.before_group();

        if (win && win.first && preview){
            //if(this.log.is_debug()) this.log.debug("win before" + win);
            win = WindowGroup.find_cloned_child(win, win, orig_win);
            //if(this.log.is_debug()) this.log.debug("win after" + win);
        }

        return win;
    }

    this.get_edge_preview = function (win, code, tiling){
        if (!this.extension.enable_edge_tiling){
            return null;
        }

        var cursor_rect = this.get_cursor_rect();
        var monitor = Compatibility.get_screen().get_current_monitor();
        var monitor_geometry = Compatibility.get_screen().get_monitor_geometry(monitor);
        var maxi = win.get_maximized_bounds(true);
        var ret = null;
        var edge_zone_width = this.extension.edge_zone_width;

        var top_zone = new Meta.Rectangle({
            x: monitor_geometry.x,
            y: monitor_geometry.y,
            width: monitor_geometry.width,
            height: edge_zone_width
        });
        var bottom_zone = new Meta.Rectangle({
            x: monitor_geometry.x,
            y: monitor_geometry.y + monitor_geometry.height - edge_zone_width,
            width: monitor_geometry.width,
            height: edge_zone_width
        });
        var left_zone = new Meta.Rectangle({
            x: monitor_geometry.x,
            y: monitor_geometry.y,
            width: edge_zone_width,
            height: monitor_geometry.height
        });
        var right_zone = new Meta.Rectangle({
            x: monitor_geometry.x + monitor_geometry.width - edge_zone_width,
            y: monitor_geometry.y,
            width: edge_zone_width,
            height: monitor_geometry.height
        });

        if (code){
            var percent = 0.5;
            var is_top = code == "up"
            var is_bottom = code == "down"
            var is_left = code == "left"
            var is_right = code == "right"
            var now = new Date().getTime();
            if (this.lastCodeTime && (now - this.lastCodeTime) < DefaultTilingStrategy.ACCELERATOR_TIMEOUT){
                if (this.lastCode == "up"){
                    if (is_top) percent = 0.3;
                    else if (is_left) percent = 0;
                    else if (is_right) percent = 1;
                    if (!is_bottom) is_top = true;
                }
                if (this.lastCode == "down"){
                    if (is_left) percent = 0;
                    else if (is_right) percent = 1;
                    if (!is_top) is_bottom = true;
                }
                if (this.lastCode == "left"){
                    if (is_top) percent = 0;
                    else if (is_bottom) percent = 0;
                    if (!is_right) is_left = true;
                }
                if (this.lastCode == "right"){
                    if (is_top) percent = 1;
                    else if (is_bottom) percent = 1;
                    if (!is_left) is_right = true;
                }

                delete this.lastCodeTime;
                delete this.lastCode;
            } else {
                this.lastCodeTime = now
                this.lastCode = code;
            }

        } else {
            var is_top = top_zone.contains_rect(cursor_rect);
            var is_bottom = bottom_zone.contains_rect(cursor_rect);
            var is_left = left_zone.contains_rect(cursor_rect);
            var is_right = right_zone.contains_rect(cursor_rect);
        }
        var is_top_or_bottom = is_top || is_bottom;
        var is_left_or_right = is_left || is_right;

        if (!code){
            var percent = null;
            if (is_top_or_bottom){

                var percent = (cursor_rect.x - monitor_geometry.x) / monitor_geometry.width;

            } else if (is_left_or_right){

                var percent = (cursor_rect.y - monitor_geometry.y) / monitor_geometry.height;

            }
        }

        if (percent != null){

            ret = maxi;
            var half_perc = Math.abs(percent - 0.5);

            if (is_top_or_bottom){

                if (half_perc >= 0.4){

                    ret.width = ret.width / 2;
                    ret.height = ret.height / 2;

                    if (percent >= 0.9){
                        ret.x += ret.width;
                    }

                    if (is_bottom){
                        ret.y += ret.height;
                    }

                } else if (half_perc >= 0.2 && half_perc < 0.4){

                    ret.height = ret.height / 2;

                    if (is_bottom){
                        ret.y += ret.height;
                    }

                } else if (half_perc < 0.2){

                    if (is_bottom){
                        ret.height = ret.height / 2;
                        ret.y += ret.height;
                    } else {

                        ret.maximize = true;

                    }

                }


            } else if (is_left_or_right){

                if (half_perc >= 0.4){

                    ret.width = ret.width / 2;
                    ret.height = ret.height / 2;

                    if (percent >= 0.9){
                        ret.y += ret.height;
                    }

                    if (is_right){
                        ret.x += ret.width;
                    }

                } else if (half_perc < 0.4){

                    ret.width = ret.width / 2;

                    if (is_right){
                        ret.x += ret.width;
                    }

                }


            }


        }

        if (version310 && this.extension.grouping_edge_tiling && ret && !ret.maximize && !!this.extension.keep_maximized){
            ret = this.get_edge_tiling(win, {
                is_top: is_top,
                is_bottom: is_bottom,
                is_left: is_left,
                is_right: is_right
            }, !tiling);
            if (ret && !tiling) ret = ret.outer_rect();
            return ret;
            //this.log.error(group_preview);
            //var preview_rect = group_preview.preview_rect(win,cursor_rect);
            //group_preview.first = null;
            //group_preview.second = null;
            //return preview_rect;
            //if(this.log.is_debug()) this.log.debug("preview_rect: " + preview_rect);
        }
        return ret;

    }

};

DefaultTilingStrategy.ACCELERATOR_TIMEOUT = 300;