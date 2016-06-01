const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Log = Extension.imports.logger.Logger.getLogger("ShellTile");
const Util = Extension.imports.util;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const GSWorkspace = imports.ui.workspace.Workspace;
const WindowGroup = Extension.imports.tiling.WindowGroup;


const OverviewModifierBase = function(){
	
	this.computeGroupData = function(clones){
		let groupOrder = [];
		let groupGeometry = {};
		let groupedSlots = [];
		let singleSlots = [];
		let cloneGroup = {};
		let cloneGroupObject = {};
		let clones1 = [];
		let idClone = {};
		
		for(var i=0; i<clones.length; i++){
			var clone = clones[i];
			var clone_meta_window = clone.metaWindow;
			
			var myWindow = this.extension.get_window(clone_meta_window, true);
			var windowId = myWindow.id();
			//if(this.log.is_debug()) this.log.debug(myWindow);
			clones1.push(windowId);
			idClone[windowId] = clone;

			if(myWindow.group && !myWindow.is_maximized()){
				var topmost_group = myWindow.group.get_topmost_group();
				var topmost_group_id = topmost_group.id();
				cloneGroupObject[topmost_group_id] = topmost_group;
				
				if(groupOrder.indexOf(topmost_group_id) < 0){
										
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
	
	this.simplifyWindows = function(windows){
		
		this.computeGroupData(windows);
		
		var windows1 = [];
		var windowIds1 = [];
		
		if(this.log.is_debug()) this.log.debug("simplifyWindows");

		for(var i=0; i<this.singleSlots.length; i++){
			
			var singleSlot = this.singleSlots[i];
			//if(this.log.is_debug()) this.log.debug("singleSlot: " + singleSlot);

			var clone = this.idClone[singleSlot];
			clone._id = ''+singleSlot;
			//if(this.log.is_debug()) this.log.debug("clone.actor.x" + clone.actor.x);
			//if(this.log.is_debug()) this.log.debug("clone.actor.y" + clone.actor.y);
			//if(this.log.is_debug()) this.log.debug("clone.actor.width" + clone.actor.width);
			//if(this.log.is_debug()) this.log.debug("clone.actor.height" + clone.actor.height);
			
			windows1.push(clone);
			windowIds1.push('' + singleSlot);
		}

		for(var i=0; i<this.groupedSlots.length; i++){
			
			var groupedSlot = this.groupedSlots[i];
			var clone = {actor: {}};
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
			
			clone._ids = cloneGroupObject.ids();
			//clone.metaWindow = top_left_window.meta_window;			
			clone.realWindow = top_left_window.get_actor();
			//clone.overlay = top_left_clone.overlay;
			
			windows1.push(clone);
			windowIds1.push('' + groupedSlot);
		}		
		
		return  [windows1, windowIds1];
	}
	
	this.explodeSlots = function(ret){
	
		if(this.log.is_debug()) this.log.debug("explodeSlots");
	
		var idRet = {};
		for(var i=0; i<ret.length; i++){
			var ret11 = ret[i][3];
			if(ret11._ids){
				for(var j=0; j<ret11._ids.length; j++){
					
					var id1 = ret11._ids[j];
					var clone = this.idClone[id1];
					if(clone){
						var myW = this.extension.get_window(clone.metaWindow);
						if(!myW.is_maximized())
							idRet[''+id1] = ret[i];
					}
				}				
			} else {
				idRet[''+ret11._id] = ret[i];				
			}	
		}
		
		var ret1 = [];
		
		for(var i=0; i<this.clones.length; i++){
			
			var cloneId = '' + this.clones[i];
			var clone = this.idClone[cloneId];
			var myWindow = this.extension.get_window(clone.metaWindow);
			
			var isGroup = this.cloneGroup[cloneId] != cloneId && myWindow.group;
			
			if(isGroup){
				var groupId = this.cloneGroup[cloneId];
				var ret2 = idRet[cloneId].slice();
				let [x, y, scale, clone2] = ret2;
				
				var update = !this.groupWindowLayouts[groupId] || !this.lastGroupPosition[groupId];
				if(!update){
					var ret_last = this.lastGroupPosition[groupId];
					update = ret_last[0] != x || ret_last[1] != y || ret_last[2] != scale;
				}
	
				if(update){
					var groupGeometry = this.groupGeometry[groupId];
					let width = groupGeometry.width * scale, height = groupGeometry.height * scale;
					
					var scaled_group_rect = new Meta.Rectangle({ x: x, y: y, width: width, height: height});
					var topmost_group = myWindow.group.get_topmost_group();
					
					this.groupWindowLayouts[groupId] = this.calculateGroupWindowLayouts(topmost_group, scaled_group_rect, scale);
					this.lastGroupPosition[groupId] = ret2;
				}
				
				var groupWindowLayouts = this.groupWindowLayouts[groupId];
				var windowLayout = groupWindowLayouts[cloneId];
				//if(this.log.is_debug()) this.log.debug("slot: " + windowLayout);			
	
				ret2[0] = windowLayout[0];
				ret2[1] = windowLayout[1];
				ret2[3] = clone;
				
			} else {
		
				var ret2 = idRet[cloneId].slice();
			
			}
			ret1.push(ret2);
			
		}
		if(this.log.is_debug()) this.log.debug("explodeSlots end");
		return ret1;
	}

	this.calculateGroupWindowLayouts =  function(topmost_group, scaled_group_rect, scale){
		
		var ret = {};
		var log = this.log;
		var scaled_gap = topmost_group.gap_between_windows() * scale;
		
		var calculateWindowLayout = function(group, rect){
			
			let first = group.first;
			let second = group.second;
			let x,y,width,height,x1,y1;
			
			if(group.type == WindowGroup.HORIZONTAL_GROUP){
				
				x = rect.x;
				y = rect.y;
				width = rect.width * group.splitPercent;
				height = rect.height;
				
				var first_scaled = new Meta.Rectangle({ x: x, y: y, width: width, height: height});
				
				x = x + width + scaled_gap;
				width = rect.x + rect.width - x;
				
				var second_scaled = new Meta.Rectangle({ x: x, y: y, width: width, height: height});
				
			} else {
				
				x = rect.x;
				y = rect.y;
				width = rect.width;
				height = rect.height * group.splitPercent;
				
				var first_scaled = new Meta.Rectangle({ x: x, y: y, width: width, height: height});
				
				y = y + height + scaled_gap;
				height = rect.y + rect.height - y;
				
				var second_scaled = new Meta.Rectangle({ x: x, y: y, width: width, height: height});
				
			}
			
			
			if(first.first){
				calculateWindowLayout(first, first_scaled);		
			} else {
				
				x1 = first_scaled.x;
				y1 = first_scaled.y;
				ret[first.id()] = [x1,y1,scale];
				
			}
			
			if(second.first){
			
				calculateWindowLayout(second, second_scaled);					
			
			} else {
				
				x1 = second_scaled.x;
				y1 = second_scaled.y;
				
				ret[second.id()] = [x1,y1,scale];			
				
			}
			
			
		}
		calculateWindowLayout(topmost_group, scaled_group_rect);
		
		return ret;
	}	
	
}

const OverviewModifier36 = function(gsWorkspace, extension){
	
	this.gsWorkspace = gsWorkspace;
	this.extension = extension;
	this.log = Log.getLogger("OverviewModifier36");
	
	this.computeNumWindowSlots = function(){
		let clones = this.gsWorkspace._windows.slice();
		
		this.computeGroupData(clones);		
		return this.groupOrder.length;
	}
	
	this._prevComputeWindowLayout = function(prevComputeWindowLayout, outer_rect, workspace, slot){
		
		
		var fakeWindow = {
				
				get_outer_rect: function(){return outer_rect;}
				
				,get_workspace: function(){
					return workspace;
				}
		}
		return prevComputeWindowLayout(fakeWindow, slot);
		
	}
	
	this.computeWindowSlots = function(numSlots, prev, prevComputeWindowLayout){
		
		let groupSlot = {};
		
		if(numSlots < 3){
		
			let basicWindowSlots = prev(numSlots);
			
			for(var i=0; i<this.groupOrder.length; i++){
				
				var group = this.groupOrder[i];
				var slot = basicWindowSlots[i];
				groupSlot[group] = slot;
			
			}			
		
		} else {
			
			let singleWeight = 1.;
			let groupedWeight = 1.5;
			let numberOfWindows = this.groupedSlots.length + this.singleSlots.length;
			let slots = [];
			//if(this.log.is_debug()) this.log.debug("this.clones.length : " + this.clones.length);	
			//if(this.log.is_debug()) this.log.debug("numberOfWindows : " + numberOfWindows);	
			
	        let gridWidth = Math.ceil(Math.sqrt(numberOfWindows));
	        let gridHeight = Math.ceil(numberOfWindows / gridWidth);			
	        let gridWidthRest = numberOfWindows % gridWidth;
	        let gridWidthSub = 0;
	        if(gridWidthRest > 0 && gridHeight > (gridWidth - gridWidthRest)){
	        	gridWidthSub = gridWidth - gridWidthRest;
	        }

			//if(this.log.is_debug()) this.log.debug("gridWidth : " + gridWidth);	
			//if(this.log.is_debug()) this.log.debug("gridHeight : " + gridHeight);
			//if(this.log.is_debug()) this.log.debug("gridWidthRest : " + gridWidthRest);
			
			//if(this.log.is_debug()) this.log.debug("this.groupedSlots.length : " + this.groupedSlots.length);
			//if(this.log.is_debug()) this.log.debug("this.groupedSlots.length : " +  this.singleSlots.length);
	        
	        var col=0;
	        var row=0;
	        var colIdx = 0;
	        var rowIdx = 0;
	        var singleSlotIdx = 0;
	        
	        let xCenter, yCenter, fraction, slot, singleSlot;
	        let nextSlots, groupedSlots, singleSlots, nextSlotsIds, currentGrouped = 0, currentSingle = 0;
	        let currentHeight, currentWidth, fractionW, fractionH;
	        let log = this.log;
	        
	        let addToRow = Lang.bind(this, function(groupedSlots, ret){
	        	
	        	for(let j=0; j<groupedSlots.length; j++){
	        		
	        		let groupedSlot = groupedSlots[j];
	        		
	        		fractionW = currentWidth * 0.95;
					fractionH = currentHeight * 0.95;
			        xCenter = currentWidth/ 2. + col;
			        yCenter = currentHeight/ 2. + row;
	        		
			        slot = [xCenter, yCenter, fractionW, fractionH];
			        //if(log.is_debug()) log.debug("slot : " + slot);
			        ret.push(slot);
			        groupSlot[groupedSlot] = slot;
			        
			        col += currentWidth;
	        		
	        	}	        	
	        	
	        	
	        });
	        
	        let calculateNextRow = Lang.bind(this, function(){
	        
	        	let ret = [];
	        	let gridWidth1 = gridWidth;
	        	if(rowIdx < gridWidthSub){
	        		gridWidth1--;
	        	}
	        		        	
	        	groupedSlots = this.groupedSlots.slice(currentGrouped, currentGrouped + gridWidth1);
	        	currentGrouped += groupedSlots.length;
	        	
	        	singleSlots = this.singleSlots.slice(currentSingle, currentSingle + (gridWidth1 - groupedSlots.length));
	        	currentSingle += singleSlots.length;
	        	
	        	 //if(log.is_debug()) log.debug("groupedSlots : " + groupedSlots);
	        	 //if(log.is_debug()) log.debug("singleSlots : " + singleSlots);
	        	
	        	currentHeight = singleWeight / gridHeight;
	        	currentWidth = singleWeight / gridWidth1;
	        	
	        	if(groupedSlots.length>0){
	        		currentHeight = groupedWeight / gridHeight;
	        		currentWidth = groupedWeight / gridWidth1;
	        	}
	        	
	        	addToRow(groupedSlots, ret);
	        	
	        	currentWidth = singleWeight / gridWidth1;
	        	
	        	addToRow(singleSlots, ret);
	        	
	        	if(col > singleWeight){
		        	for(let j=0; j<ret.length; j++){
		        		
		        		let slot1 = ret[j];
		        		slot1[0] = slot1[0] / col * singleWeight;
		        		slot1[2] = slot1[2] / col * singleWeight;
		        	}
	        	} else {
	        		
		        	for(let j=0; j<ret.length; j++){
		        		
		        		let slot1 = ret[j];
		        		slot1[0] += (singleWeight - col) / 2.;
		        	}	        		
	        		
	        	}
	        	for(let j=0; j<ret.length; j++){
	        		
	        		let slot1 = ret[j];
	        		//if(log.is_debug()) log.debug("slot1 : " + slot1);
	        	}
	        	
	        	return ret;
	        	
	        	
	        });
	        	
	        while(!nextSlots || nextSlots.length > 0){
	        	
	        	nextSlots = calculateNextRow();
	        	
	        	if(nextSlots.length > 0){
	        		slots = slots.concat(nextSlots);
	        		row += currentHeight;
	        		rowIdx++;
	        		col = 0;
	        	
	        	}
	        	
	        }	
		
			
	    	for(let j=0; j<slots.length; j++){
	    		
	    		let slot1 = slots[j];
	    		slot1[1] = slot1[1] / row;
	    		slot1[3] = slot1[3] / row;
	    		
	    	}
			
		}
		
		var ret = [];
		
		for(var i=0; i<this.clones.length; i++){
			
			var cloneId = this.clones[i];
			
			var cloneGroup = this.cloneGroup[cloneId];
			var cloneSlot = groupSlot[cloneGroup];
			
			ret.push(cloneSlot);
			
		}		

		return ret;
		
	}
	
	this.getSlotGeometry = function(slot, workspace, prev){
		
		if(slot.length == 3){
			return prev(slot);		
		}
		
		let [xCenter, yCenter, fractionW, fractionH] = slot;
			
		let width = workspace._width * fractionW;
        let height = workspace._height * fractionH;
		
        let x = workspace._x + xCenter * workspace._width - width / 2 ;
        let y = workspace._y + yCenter * workspace._height - height / 2;

        return [x, y, width, height];

	}
	
	this.computeWindowLayout = function(metaWindow, slot, prev){
		
		var myWindow = this.extension.get_window(metaWindow);
		
		if(!myWindow.group || myWindow.is_maximized()){
			return 	prev(metaWindow, slot);	
		} else {
			
			var topmost_group = myWindow.group.get_topmost_group();
			var id = topmost_group.id();
			if(this.groupWindowLayouts[id]){
				
				return this.groupWindowLayouts[id][myWindow.id()];
				
			} else {
			
				var outer_rect = topmost_group.outer_rect(true);
				let [x,y,scale] = this._prevComputeWindowLayout(prev, outer_rect, metaWindow.get_workspace(), slot);
				
				let width = outer_rect.width * scale;
				let height = outer_rect.height * scale;
				
				var scaled_group_rect = new Meta.Rectangle({ x: x, y: y, width: width, height: height});
				let groupWindowLayout = this.calculateGroupWindowLayouts(topmost_group, scaled_group_rect, scale);
			
				this.groupWindowLayouts[id] = groupWindowLayout;
				return groupWindowLayout[myWindow.id()];
				
			}
		}
	}
	
	this.orderWindowsByMotionAndStartup = function(clones, slots){

		let arraySequences = {}
		for(let j=0; j<clones.length; j++){
			let clone = clones[j];
			arraySequences[clone.metaWindow.get_stable_sequence()] = j;	
		}
        
		clones.sort(function(w1, w2) {
            return w2.metaWindow.get_stable_sequence() - w1.metaWindow.get_stable_sequence();
        });
		
		let ret = [];
		for(let j=0; j<clones.length; j++){
			let clone = clones[j];
			let arraySequence = arraySequences[clone.metaWindow.get_stable_sequence()];
			ret.push(slots[arraySequence]);
		}
		
		slots.splice(0, slots.length);
		for(let j=0; j<ret.length; j++){
			let slot = ret[j];
			slots.push(slot);
		}
		
		return clones;
        
	};
	
}
OverviewModifier36.prototype = new OverviewModifierBase();

const OverviewModifier38 = function(extension){
	
	this.extension = extension;
	this.log = Log.getLogger("OverviewModifier38");
	
	this.computeWindowSlots = function(windows, prev){
		
		let [windows1, windowsIds1] = this.simplifyWindows(windows);

		var slots = prev(windows1);
		
		return this.explodeSlots(slots);
		
	}
	
}
OverviewModifier38.prototype = new OverviewModifierBase();

const OverviewModifier310 = function(extension){
	
	this.extension = extension;
	this.log = Log.getLogger("OverviewModifier310");
	
	this.computeLayout = function(windows, prev){
		
		var me = this;
		let [windows1, windowsIds1] = this.simplifyWindows(windows);

		var layout = prev(windows1);
		
		var prevComputeWindowSlots = layout.strategy.computeWindowSlots;
		layout.strategy.computeWindowSlots = function(layout, area){
			
			var prevC = Lang.bind(this, prevComputeWindowSlots);
			var slots = prevC(layout, area);
			
			return me.explodeSlots(slots);
		}
		
		return layout;
		
	}
	
}
OverviewModifier310.prototype = new OverviewModifierBase();

const OverviewModifier = function(){};

OverviewModifier.register = function(extension){
	if(OverviewModifier._registered) return;
	
	var prevComputeAllWindowSlots = GSWorkspace.prototype._computeAllWindowSlots;
	var prevDestroy = GSWorkspace.prototype.destroy;
	var prevComputeWindowLayout = GSWorkspace.prototype._computeWindowLayout;
	var prevOrderWindowsByMotionAndStartup = GSWorkspace.prototype._orderWindowsByMotionAndStartup
	var prevGetSlotGeometry = GSWorkspace.prototype._getSlotGeometry;
	var prevComputeLayout = GSWorkspace.prototype._computeLayout;
	
	let version36 = Util.versionCompare(Config.PACKAGE_VERSION, "3.6") >= 0 && Util.versionCompare(Config.PACKAGE_VERSION, "3.7") < 0;
	version36 = version36 && prevComputeAllWindowSlots;
	version36 = version36 && prevDestroy;
	version36 = version36 && prevComputeWindowLayout;
	version36 = version36 && prevOrderWindowsByMotionAndStartup;
	version36 = version36 && prevGetSlotGeometry;
	
	let version38 = Util.versionCompare(Config.PACKAGE_VERSION, "3.7") >= 0 && Util.versionCompare(Config.PACKAGE_VERSION, "3.9") < 0;
	version38 = version38 && prevComputeAllWindowSlots;
	
	let version310 = Util.versionCompare(Config.PACKAGE_VERSION, "3.9") >= 0;
	version310 = version310 && prevComputeLayout;
	
	if(version36){
	
		GSWorkspace.prototype._computeAllWindowSlots = function(totalWindows){
			var prev = Lang.bind(this, prevComputeAllWindowSlots);
			if(!extension.enabled) return prev(totalWindows);
			
			this._shellTileOverviewModifier = new OverviewModifier36(this, extension);
			var numSlots = this._shellTileOverviewModifier.computeNumWindowSlots();
			
			var prevComputeWindowLayout1 = Lang.bind(this, prevComputeWindowLayout);
			return this._shellTileOverviewModifier.computeWindowSlots(numSlots, prev, prevComputeWindowLayout1);
		}
		
		GSWorkspace.prototype.destroy = function(){
			var prev = Lang.bind(this, prevDestroy);
			if(!extension.enabled) return prev();
			
			delete this._shellTileOverviewModifier;
			return prev();
		}
		
		GSWorkspace.prototype._computeWindowLayout = function(metaWindow, slot){
			let prev = Lang.bind(this, prevComputeWindowLayout);		
			if(!extension.enabled) return prev(metaWindow, slot);
			
			return this._shellTileOverviewModifier.computeWindowLayout(metaWindow, slot, prev);
		}
		
		GSWorkspace.prototype._orderWindowsByMotionAndStartup = function(clones, slots) {
			let prev = Lang.bind(this, prevOrderWindowsByMotionAndStartup);
			if(!extension.enabled) return prev(clones, slots);
			
			return this._shellTileOverviewModifier.orderWindowsByMotionAndStartup(clones, slots);
		}	
		
		GSWorkspace.prototype._getSlotGeometry = function(slot){
			let prev = Lang.bind(this, prevGetSlotGeometry);
			if(!extension.enabled) return prev(slot);
			
			return this._shellTileOverviewModifier.getSlotGeometry(slot, this, prev);
		}
		
	} else if(version38){
		
		GSWorkspace.prototype._computeAllWindowSlots = function(windows){
			var prev = Lang.bind(this, prevComputeAllWindowSlots);
			if(!extension.enabled) return prev(windows);
			
			this._shellTileOverviewModifier = new OverviewModifier38(extension);
			return this._shellTileOverviewModifier.computeWindowSlots(windows, prev);
		}
		
	} else if(version310){
		
		GSWorkspace.prototype._computeLayout = function(windows){
			var prev = Lang.bind(this, prevComputeLayout);
			if(!extension.enabled) return prev(windows);
			
			this._shellTileOverviewModifier = new OverviewModifier310(extension);
			return this._shellTileOverviewModifier.computeLayout(windows, prev);	
		}
		
	}
	
	OverviewModifier._registered = true;	
}
