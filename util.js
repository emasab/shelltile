const Config = imports.misc.config;

function versionCompare(first, second) {
    if(!first) first = Config.PACKAGE_VERSION;
    first = first.split('.');
    second = second.split('.');
	
    for (let i = 0; i < first.length; i++) {
        first[i] = parseInt(first[i]);
    }
    
    for (let i = 0; i < second.length; i++) {
        second[i] = parseInt(second[i]);
    }


    for (let i = 0; i < first.length; i++) {
        if(i >= second.length) return 1;
        if (first[i] != second[i])
            return first[i] - second[i];
    }
    if(second.length > i) return -1;
    return 0;
}


const Compatibility = new (function(){

    var _wsmgr = global.workspace_manager;
    var _screen = global.screen;
    var _display = global.display;

    if(_screen && (!_wsmgr || !_wsmgr.get_workspace_by_index || !_wsmgr.get_n_workspaces)) _wsmgr = null;
    if(_screen && (!_display || !_display.get_current_monitor || !_display.get_monitor_geometry)) _display = null;

    this.get_workspace_manager = function(){ return _wsmgr ? _wsmgr : _screen; }
    this.get_screen = function(){ return _display ? _display : _screen; }
    this.get_display = function(){ return _display ? _display : _screen.get_display(); }

})();