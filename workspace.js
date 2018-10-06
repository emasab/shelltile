const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");
const Compatibility = Extension.imports.util.Compatibility;

function Workspace() {
    this._init.apply(this, arguments)
}
Workspace.prototype = {

    _init : function(meta_workspace, ext, strategy) {
        this._shellwm =  global.window_manager;
        this.log = Log.getLogger("Workspace");
        this.meta_workspace = meta_workspace;
        this.extension = ext;
        this.strategy = strategy
		
        this.meta_windows().map(Lang.bind(this, function(win) { this.extension.on_window_create(null, win); }));
    },

    _disable: function() {
        var self = this;
        this.extension.disconnect_tracked_signals(this);
        this.meta_workspace = null;
        this.extension = null;
    },
	
    id: function(){
        return this.meta_workspace.toString();
    },

    toString: function() {
        return "<# Workspace at idx " + this.meta_workspace.index() + ">";
    },

    meta_windows: function() {
        var self = this;

        var wins = global.get_window_actors().map(function (act) {
                return act.meta_window;
            });

        wins = wins.filter(function (win) {
            return win.get_workspace() === self.meta_workspace;
        });
	
        wins = Compatibility.get_display().sort_windows_by_stacking(wins);
		
        return wins;
    }
}