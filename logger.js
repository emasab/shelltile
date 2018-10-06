const GLib = imports.gi.GLib;

const Logger = function(name, level){
    let self = this;
    self.base = name;
    if(!level){
        level = Logger.DEFAULT_LEVEL;
    }
    self.level = level;

    var checkLevel = function(level){
        return level === undefined || self.level === undefined || level >= self.level;
    }
    
    self.log = function(name, message, level){
        if(checkLevel(level)){
            global.log("[" + name + "]" + self.base + " " + message);
        }
    }

    self.debug = function(message){
        self.log("DEBUG", message, Logger.LEVEL_DEBUG);    
    }
    
    self.info = function(message){
        self.log("INFO", message, Logger.LEVEL_INFO);    
    }

    self.warn = function(message){
        self.log("WARN", message, Logger.LEVEL_WARN);    
    }

    self.error = function(message){
        self.log("ERROR", message, Logger.LEVEL_ERROR);    
    }    
    
    self.getLogger = function(clazz){
        return new Logger(self.base + "[" + clazz + "]", self.level);
    }
    
    self.is_debug = function(){
        return checkLevel(Logger.LEVEL_DEBUG);
    }
    
    self.is_info = function(){
        return checkLevel(Logger.LEVEL_INFO);
    }
    
    self.is_warn = function(){
        return checkLevel(Logger.LEVEL_WARN);
    }
    
    self.is_error = function(){
        return checkLevel(Logger.LEVEL_ERROR);
    }
}

Logger.LEVEL_DEBUG = 0;
Logger.LEVEL_INFO = 1;
Logger.LEVEL_WARN = 2;
Logger.LEVEL_ERROR = 3;

Logger.DEFAULT_LEVEL = Logger.LEVEL_ERROR;
if(GLib.getenv("SHELLTILE_DEBUG")){
	
    Logger.DEFAULT_LEVEL = Logger.LEVEL_DEBUG;
	
}

Logger.getLogger = function(module){
    return new Logger("[" + module + "]");
}