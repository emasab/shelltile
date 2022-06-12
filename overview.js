const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");
const Util = Extension.imports.util;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const GSWorkspace = imports.ui.workspace.Workspace;
const GSWorkspaceLayout = imports.ui.workspace.WorkspaceLayout;
const UnalignedLayoutStrategy = imports.ui.workspace.UnalignedLayoutStrategy;
const WindowGroup = Extension.imports.tiling.WindowGroup;

class OverviewModifierBase{

    computeGroupData (clones){
        let groupOrder = [];
        let groupGeometry = {};
        let groupedSlots = [];
        let singleSlots = [];
        let cloneGroup = {};
        let cloneGroupObject = {};
        let clones1 = [];
        let idClone = {};

        for (var i = 0; i < clones.length; i++){
            var clone = clones[i];
            var clone_meta_window = clone.metaWindow;

            var myWindow = this.extension.get_window(clone_meta_window, true);
            var windowId = myWindow.id();
            //if (this.log.is_debug()) this.log.debug(myWindow);
            clones1.push(windowId);
            idClone[windowId] = clone;

            var isGroup = !myWindow.is_maximized();
            if (isGroup) isGroup &= !!myWindow.group;
            if (isGroup) isGroup &= !!myWindow.group.get_topmost_group().get_first_non_fake_window().get_first_non_fake_window;

            if (isGroup){
                var topmost_group = myWindow.group.get_topmost_group(true);
                var topmost_group_id = topmost_group.id();
                cloneGroupObject[topmost_group_id] = topmost_group;

                if (groupOrder.indexOf(topmost_group_id) < 0){

                    groupOrder.push(topmost_group_id);

                    groupedSlots.push(topmost_group_id);

                    groupGeometry[topmost_group_id] = topmost_group.outer_rect(true);

                }
                cloneGroup[windowId] = topmost_group_id;

            } else {

                groupOrder.push(windowId);
                groupGeometry[windowId] = myWindow.outer_rect();
                singleSlots.push(windowId);
                cloneGroup[windowId] = windowId;
            }
        }

        this.groupOrder = groupOrder;
        this.groupGeometry = groupGeometry;
        this.groupedSlots = groupedSlots;
        this.singleSlots = singleSlots;
        this.cloneGroup = cloneGroup;
        this.cloneGroupObject = cloneGroupObject;
        this.clones = clones1;
        this.idClone = idClone;
        this.groupWindowLayouts = {};
        this.lastGroupPosition = {};

    }

    simplifyWindows (windows){

        this.computeGroupData(windows);

        var windows1 = [];
        var windowIds1 = [];

        //if (this.log.is_debug()) this.log.debug("simplifyWindows");

        for (var i = 0; i < this.singleSlots.length; i++){

            var singleSlot = this.singleSlots[i];
            //if(this.log.is_debug()) this.log.debug("singleSlot: " + singleSlot);

            var clone = this.idClone[singleSlot];
            clone._id = '' + singleSlot;
            //if(this.log.is_debug()) this.log.debug("clone.actor.x" + clone.actor.x);
            //if(this.log.is_debug()) this.log.debug("clone.actor.y" + clone.actor.y);
            //if(this.log.is_debug()) this.log.debug("clone.actor.width" + clone.actor.width);
            //if(this.log.is_debug()) this.log.debug("clone.actor.height" + clone.actor.height);

            windows1.push(clone);
            windowIds1.push('' + singleSlot);
        }

        for (var i = 0; i < this.groupedSlots.length; i++){

            var groupedSlot = this.groupedSlots[i];
            var clone = {
                actor: {}
            };
            var cloneGroupObject = this.cloneGroupObject[groupedSlot];
            var top_left_window = cloneGroupObject.top_left_window();
            var top_left_clone = this.idClone[top_left_window.id()];

            var geometry = this.groupGeometry[groupedSlot];
            clone.actor.x = geometry.x;
            clone.actor.y = geometry.y;
            clone.actor.width = geometry.width;
            clone.actor.height = geometry.height;
            clone.x = geometry.x;
            clone.y = geometry.y;
            clone.width = geometry.width;
            clone.height = geometry.height;
            clone.windowCenter = {
                x: (clone.x + parseInt(clone.width/2)),
                y: (clone.y + parseInt(clone.height/2))
            };
            clone.boundingBox = {
            	width: geometry.width,
            	height: geometry.height
            };

            clone._ids = cloneGroupObject.ids();
            //clone.metaWindow = top_left_window.meta_window;			
            clone.realWindow = top_left_window.get_actor();
            //clone.overlay = top_left_clone.overlay;

            windows1.push(clone);
            windowIds1.push('' + groupedSlot);
        }

        return [windows1, windowIds1];
    }

    explodeSlots (ret){

        if (this.log.is_debug()) this.log.debug("explodeSlots");

        var idRet = {};
        for (var i = 0; i < ret.length; i++){
            var ret11 = ret[i][ret[i].length - 1];
            if (ret11._ids){
                for (var j = 0; j < ret11._ids.length; j++){

                    var id1 = ret11._ids[j];
                    var clone = this.idClone[id1];
                    if (clone){
                        var myW = this.extension.get_window(clone.metaWindow);
                        if (!myW.is_maximized())
                            idRet['' + id1] = ret[i];
                    }
                }
            } else {
                idRet['' + ret11._id] = ret[i];
            }
        }

        var ret1 = [];

        for (var i = 0; i < this.clones.length; i++){

            var cloneId = '' + this.clones[i];
            var clone = this.idClone[cloneId];
            var myWindow = this.extension.get_window(clone.metaWindow);

            var isGroup = this.cloneGroup[cloneId] != cloneId && myWindow.group;

            if (isGroup){
                var groupId = this.cloneGroup[cloneId];
                var groupGeometry = this.groupGeometry[groupId];
                var ret2 = idRet[cloneId].slice();
                let x, y, scale, width, height, clone2;
                if (ret2.length == 4){
                    [x, y, scale, clone2] = ret2;
                    width = groupGeometry.width * scale;
                    height = groupGeometry.height * scale;
                } else if (ret2.length == 5){
                    [x, y, width, height, clone2] = ret2;
                    scale = width / groupGeometry.width;
                }

                var update = !this.groupWindowLayouts[groupId] || !this.lastGroupPosition[groupId];
                if (!update){
                    var ret_last = this.lastGroupPosition[groupId];
                    update = ret_last[0] != x || ret_last[1] != y || ret_last[2] != scale;
                }

                if (update){
                    var scaled_group_rect = new Meta.Rectangle({
                        x: x,
                        y: y,
                        width: width,
                        height: height
                    });
                    var topmost_group = myWindow.group.get_topmost_group(true);

                    this.groupWindowLayouts[groupId] = this.calculateGroupWindowLayouts(topmost_group, scaled_group_rect, scale);
                    this.lastGroupPosition[groupId] = ret2;
                }

                var groupWindowLayouts = this.groupWindowLayouts[groupId];
                var windowLayout = groupWindowLayouts[cloneId];			

                if (ret2.length == 4){
                    ret2[0] = windowLayout[0];
                    ret2[1] = windowLayout[1];
                    ret2[2] = scale;
                    ret2[3] = clone;
                } else if (ret2.length == 5){
                    let myWindowOuterRect = myWindow.outer_rect();
                    ret2[0] = windowLayout[0];
                    ret2[1] = windowLayout[1];
                    ret2[2] = myWindowOuterRect.width * scale;
                    ret2[3] = myWindowOuterRect.height * scale;
                    ret2[4] = clone;
                }
            } else {

                var ret2 = idRet[cloneId].slice();

            }
            ret1.push(ret2);

        }
        if (this.log.is_debug()) this.log.debug("explodeSlots end");
        return ret1;
    }

    calculateGroupWindowLayouts (topmost_group, scaled_group_rect, scale){

        var ret = {};
        var log = this.log;
        var scaled_gap = topmost_group.gap_between_windows() * scale;

        var calculateWindowLayout = function (group, rect){

            let first = group.first;
            let second = group.second;
            let secondOuterRect = second.outer_rect();
            let x, y, width, height, x1, y1;

            if (group.type == WindowGroup.HORIZONTAL_GROUP){

                x = rect.x;
                y = rect.y;
                width = rect.width * group.splitPercent;
                height = rect.height;

                var first_scaled = new Meta.Rectangle({
                    x: x,
                    y: y,
                    width: width,
                    height: height
                });

                var scaledWidth = secondOuterRect.width * scale;

                x = x + rect.width - scaledWidth;
                width = scaledWidth;

                var second_scaled = new Meta.Rectangle({
                    x: x,
                    y: y,
                    width: width,
                    height: height
                });

            } else {

                x = rect.x;
                y = rect.y;
                width = rect.width;
                height = rect.height * group.splitPercent;

                var first_scaled = new Meta.Rectangle({
                    x: x,
                    y: y,
                    width: width,
                    height: height
                });

                var scaledHeight = secondOuterRect.height * scale;

                y = y + rect.height - scaledHeight;
                height = scaledHeight;

                var second_scaled = new Meta.Rectangle({
                    x: x,
                    y: y,
                    width: width,
                    height: height
                });

            }


            if (first.first){
                calculateWindowLayout(first, first_scaled);
            } else {

                x1 = first_scaled.x;
                y1 = first_scaled.y;
                ret[first.id()] = [x1, y1, scale];

            }

            if (second.first){

                calculateWindowLayout(second, second_scaled);

            } else {

                x1 = second_scaled.x;
                y1 = second_scaled.y;

                ret[second.id()] = [x1, y1, scale];

            }


        }
        calculateWindowLayout(topmost_group, scaled_group_rect);

        return ret;
    }
}

class OverviewModifier38 extends OverviewModifierBase{

    constructor(extension){
        super();
        this.extension = extension;
        this.log = Log.getLogger("OverviewModifier38");
    }

    computeWindowSlots (windows, prev){

        let [windows1, windowsIds1] = this.simplifyWindows(windows);

        var slots = prev(windows1);

        return this.explodeSlots(slots);

    }

}

class OverviewModifier310 extends OverviewModifierBase{

    constructor (extension){
        super();
        this.extension = extension;
        this.log = Log.getLogger("OverviewModifier310");
    }

    computeLayout (windows, prev){
        var me = this;
        let [windows1, windowsIds1] = this.simplifyWindows(windows);

        var layout = prev(windows1);

        var prevComputeWindowSlots = layout.strategy.computeWindowSlots;
        layout.strategy.computeWindowSlots = function (layout, area){

            var prevC = prevComputeWindowSlots.bind(this);
            var slots = prevC(layout, area);

            return me.explodeSlots(slots);
        }

        return layout;
    }

}

class OverviewModifier338 extends OverviewModifierBase{

    constructor (extension){
        super();
        this.extension = extension;
        this.log = Log.getLogger("OverviewModifier338");
    }

    getWindowSlots (containerBox){
        const mod = this._shellTileOverviewModifier;
        [, , containerBox] =
            this._adjustSpacingAndPadding(null, null, containerBox);

        const availArea = {
            x: parseInt(containerBox.x1),
            y: parseInt(containerBox.y1),
            width: parseInt(containerBox.get_width()),
            height: parseInt(containerBox.get_height()),
        };

        const slots = this._layout.strategy.computeWindowSlots(this._layout, availArea);
        const explodedSlots = mod.explodeSlots(slots);
        return explodedSlots;
    }

    createBestLayout (area){
    	const mod = this._shellTileOverviewModifier;
    	let [windows1, windowsIds1] = mod.simplifyWindows(this._sortedWindows);
    	this._sortedWindowShellTile = windows1;
        
        const [rowSpacing, colSpacing] =
            this._adjustSpacingAndPadding(this._spacing, this._spacing, null);

        // We look for the largest scale that allows us to fit the
        // largest row/tallest column on the workspace.
        const strategy = new UnalignedLayoutStrategy(
            Main.layoutManager.monitors[this._monitorIndex],
            rowSpacing,
            colSpacing);

        let lastLayout = {};

        for (let numRows = 1; ; numRows++){
            let numColumns = Math.ceil(this._sortedWindowShellTile.length / numRows);

            // If adding a new row does not change column count just stop
            // (for instance: 9 windows, with 3 rows -> 3 columns, 4 rows ->
            // 3 columns as well => just use 3 rows then)
            if (numColumns === lastLayout.numColumns)
                break;

            let layout = { area, strategy, numRows, numColumns };
            strategy.computeLayout(this._sortedWindowShellTile, layout);
            strategy.computeScaleAndSpace(layout);

            if (!this._isBetterLayout(lastLayout, layout))
                break;

            lastLayout = layout;
        }

        return lastLayout;
    }

}

var OverviewModifier = class OverviewModifier{
    static register(extension){
        let prevComputeAllWindowSlots = GSWorkspace && GSWorkspace.prototype._computeAllWindowSlots;
        let prevComputeLayout = GSWorkspace && GSWorkspace.prototype._computeLayout;
        let prevCreateBestLayout = GSWorkspaceLayout && GSWorkspaceLayout.prototype._createBestLayout;
        let prevGetWindowSlots = GSWorkspaceLayout && GSWorkspaceLayout.prototype._getWindowSlots;
    
        let version38 = Util.versionCompare(Config.PACKAGE_VERSION, "3.7") >= 0 && Util.versionCompare(Config.PACKAGE_VERSION, "3.9") < 0;
        version38 = version38 && prevComputeAllWindowSlots;
    
        let version310 = Util.versionCompare(Config.PACKAGE_VERSION, "3.9") >= 0;
        version310 = version310 && prevComputeLayout;
        
        let version338 = Util.versionCompare(Config.PACKAGE_VERSION, "3.38") >= 0;
        version338 = version338 && prevCreateBestLayout && prevGetWindowSlots;

        let restore;
        OverviewModifier._gsWorkspaceInstances = [];

        if (version38){
    
            GSWorkspace.prototype._computeAllWindowSlots = function (windows){
                var prev = prevComputeAllWindowSlots.bind(this);
                if (!extension.enabled) return prev(windows);
    
                if (!this._shellTileOverviewModifier){
                    this._shellTileOverviewModifier = new OverviewModifier38(extension);
                    OverviewModifier._gsWorkspaceInstances.push(this);
                }
                return this._shellTileOverviewModifier.computeWindowSlots(windows, prev);
            }
            restore = () => {
                GSWorkspace.prototype._computeAllWindowSlots = prevComputeAllWindowSlots;
            }
    
        } else if (version310){
    
            GSWorkspace.prototype._computeLayout = function (windows){
                var prev = prevComputeLayout.bind(this);
                if (!extension.enabled) return prev(windows);
    
                if (!this._shellTileOverviewModifier){
                    this._shellTileOverviewModifier = new OverviewModifier310(extension);
                    OverviewModifier._gsWorkspaceInstances.push(this);
                }
                return this._shellTileOverviewModifier.computeLayout(windows, prev);
            }
            restore = () => {
                GSWorkspace.prototype._computeLayout = prevComputeLayout;
            }
    
        } else if (version338){
            GSWorkspaceLayout.prototype._createBestLayout = function (area){
                let prev = prevCreateBestLayout.bind(this);
                if (!extension.enabled) return prev(area);
                
                if (!this._shellTileOverviewModifier){
                    this._shellTileOverviewModifier = new OverviewModifier338(extension);
                    OverviewModifier._gsWorkspaceInstances.push(this);
                }
                return this._shellTileOverviewModifier.createBestLayout.bind(this)(area, prev);
            }
            
            GSWorkspaceLayout.prototype._getWindowSlots = function (area){
                let prev = prevGetWindowSlots.bind(this);
                if (!extension.enabled) return prev(area);
                return this._shellTileOverviewModifier.getWindowSlots.bind(this)(area, prev);
            }
            restore = () => {
                GSWorkspace.prototype._createBestLayout = prevCreateBestLayout;
                GSWorkspace.prototype._getWindowSlots = prevGetWindowSlots;
            }
        }

        OverviewModifier._restore = () => {
            OverviewModifier._gsWorkspaceInstances.forEach((inst) => {
                delete inst._shellTileOverviewModifier;
            });
            restore();
        }
    }

    static unregister(extension){
        if (OverviewModifier._restore)  OverviewModifier._restore();
    }
}
