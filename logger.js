const GLib = imports.gi.GLib;


class Logger{
    constructor(name, level){
        this.base = name;
        if (!level){
            level = Logger.DEFAULT_LEVEL;
        }
        this.level = level;
    }

    checkLevel(level){
        return level === undefined || this.level === undefined || level >= this.level;
    }

    log (name, message, level){
        if (this.checkLevel(level)){
            global.log("[" + name + "]" + this.base + " " + message);
        }
    }

    debug (message){
        this.log("DEBUG", message, Logger.LEVEL_DEBUG);
    }

    info (message){
        this.log("INFO", message, Logger.LEVEL_INFO);
    }

    warn (message){
        this.log("WARN", message, Logger.LEVEL_WARN);
    }

    error (message){
        this.log("ERROR", message, Logger.LEVEL_ERROR);
    }

    getLogger (clazz){
        return new Logger(this.base + "[" + clazz + "]", this.level);
    }

    is_debug (){
        return this.checkLevel(Logger.LEVEL_DEBUG);
    }

    is_info (){
        return this.checkLevel(Logger.LEVEL_INFO);
    }

    is_warn (){
        return this.checkLevel(Logger.LEVEL_WARN);
    }

    is_error (){
        return this.checkLevel(Logger.LEVEL_ERROR);
    }
}

Logger.LEVEL_DEBUG = 0;
Logger.LEVEL_INFO = 1;
Logger.LEVEL_WARN = 2;
Logger.LEVEL_ERROR = 3;

Logger.DEFAULT_LEVEL = Logger.LEVEL_WARN;
if (GLib.getenv("SHELLTILE_DEBUG")){

    Logger.DEFAULT_LEVEL = Logger.LEVEL_DEBUG;

}

Logger.getLogger = function (module){
    return new Logger("[" + module + "]");
}