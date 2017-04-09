const Gtk = imports.gi.Gtk;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;
const Gettext = imports.gettext.domain('shelltile');
const _ = Gettext.gettext;

const SCHEMA = "org.gnome.shell.extensions.shelltile";

let gsettings;
let settings;

function init() {
	Convenience.initTranslations();
	
	gsettings = Convenience.getSettings();
	
    settings = {
    		"keep-group-maximized": {
    			 type: "b",
    			 label: _("Keep the window group maximized")
    		},
    		"mouse-split-percent": {
	   			 type: "b",
	   			 label: _("Adjust the split percentage with the mouse while tiling")
	   		},    		
    		"gap-between-windows": {
	   			 type: "i",
	   			 label: _("Size of the gaps between the windows"),
	   			 min: 0,
	   			 max: 10,
	   			 step: 1
	   		}
    };
	
}

function buildPrefsWidget() {
	
    let frame = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
        border_width: 10});
	let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL,
	       margin: 20, margin_top: 10 });
	
	let hbox;
	for (setting in settings) {
		hbox = buildHbox(settings, setting);
		vbox.add(hbox);
	}
	
	frame.add(vbox);
	frame.show_all();
	
	return frame;
	
}

function buildHbox(settings, setting) {
    let hbox;

    if (settings[setting].type == "i")
        hbox = createIntSetting(settings, setting);
    if (settings[setting].type == "b")
        hbox = createBoolSetting(settings, setting);

    return hbox;
}


function createBoolSetting(settings, setting) {

	let settingsV = settings[setting];
	let settingsId = setting;
	
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settingsV.label,
                                       xalign: 0, hexpand: true, margin_right: 20 });

    let setting_switch = new Gtk.Switch({active: gsettings.get_boolean(settingsId)});
    setting_switch.connect('notify::active', function(button) {
        gsettings.set_boolean(settingsId, button.active);
    });

    if (settingsV.help) {
        setting_label.set_tooltip_text(settingsV.help)
        setting_switch.set_tooltip_text(settingsV.help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
}

function createIntSetting(settings, setting) {
	
	let settingsV = settings[setting];
	let settingsId = setting;
	
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settingsV.label,
                                       xalign: 0 , hexpand: true, margin_right: 20 });

    let adjustment = new Gtk.Adjustment({ lower: settingsV.min || 0,
                                          upper: settingsV.max || 65535,
                                          step_increment: settingsV.step || 1});
    let setting_int = new Gtk.SpinButton({adjustment: adjustment,
                                          snap_to_ticks: true});
    setting_int.set_value(gsettings.get_int(settingsId));
    setting_int.connect('value-changed', function(entry) {
        gsettings.set_int(settingsId, entry.value);
    });

    if (settingsV.help) {
        setting_label.set_tooltip_text(settingsV.help)
        setting_int.set_tooltip_text(settingsV.help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_int);

    return hbox;
}
