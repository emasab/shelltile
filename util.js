const Config = imports.misc.config;

function versionCompare(first, second){
    if (!first) first = Config.PACKAGE_VERSION;
    first = first.split('.');
    second = second.split('.');

    for (let i = 0; i < first.length; i++){
        first[i] = parseInt(first[i]);
    }

    for (let i = 0; i < second.length; i++){
        second[i] = parseInt(second[i]);
    }


    for (let i = 0; i < first.length; i++){
        if (i >= second.length) return 1;
        if (first[i] != second[i])
            return first[i] - second[i];
    }
    if (second.length > i) return -1;
    return 0;
}


var Compatibility = class Compatibility{
    constructor(){
        let _wsmgr = global.workspace_manager;
        let _screen = global.screen;
        let _display = global.display;
    
        if (_screen && (!_wsmgr || !_wsmgr.get_workspace_by_index || !_wsmgr.get_n_workspaces)) _wsmgr = null;
        if (_screen && (!_display || !_display.get_current_monitor || !_display.get_monitor_geometry)) _display = null;

        this._wsmgr = _wsmgr;
        this._screen = _screen;
        this._display = _display;
    }

    get_workspace_manager (){
        return this._wsmgr || this._screen;
    }

    get_screen (){
        return this._display || this._screen;
    }

    get_display (){
        return this._display || this._screen.get_display();
    }
}
