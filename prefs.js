const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

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
	   		},
    		"tile-modifier-key": {
	   			 type: "s",
	   			 label: _("Key to hold for tiling")
	   		},
    		"top-edge-maximize": {
	   			 type: "b",
	   			 label: _("Top edge maximize active")
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
    if (settings[setting].type == "s")
        hbox = createStringSetting(settings, setting);

    return hbox;
}

/** Adapted from https://developer.gnome.org/gnome-devel-demos/stable/combobox.js.html.en#combobox
 * @author Eemil Lagerspetz
 */
function createStringSetting(settings, setting) {
   
	let settingsV = settings[setting];
	let settingsId = setting;
	
    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL,
                            margin_top: 5});

    let setting_label = new Gtk.Label({label: settingsV.label,
                                       xalign: 0, hexpand: true, margin_right: 20 });

 // This is to add the 'combo' filtering options
    store = new Gtk.ListStore();
    store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
    store.set(store.append(), [0], ['Ctrl']);
    store.set(store.append(), [0], ['Super']);
    store.set(store.append(), [0], [_('Ctrl or Super')]); 

    combo = new Gtk.ComboBox({ model: store });
    renderer = new Gtk.CellRendererText();
    combo.pack_start(renderer, false);
    combo.add_attribute(renderer, "text", 0);
    combo.set_active(0);
    let previousValue = gsettings.get_string(settingsId);
    if (previousValue === 'Super')
      combo.set_active(1);
    if (previousValue === 'Ctrl or Super')
      combo.set_active(2);
    
    combo.connect ('changed', (widget) => {
        let model, active, type, text, filter; 

        model = widget.get_model();
        active = widget.get_active_iter()[1];

        type = model.get_value(active, 0);
        gsettings.set_string(settingsId, type);
    });


    // Create the combobox
/*    this.tile_key_setting = new Gtk.ComboBoxText();

    let options = ["Ctrl", "Super", "Ctrl or Super"];
                
    for (let i = 0; i < options.length; i++ ) {
        this.tile_key_setting.append_text(options[i]);
    }
    
    this.tile_key_setting.set_active(0);*/

    if (settingsV.help) {
        setting_label.set_tooltip_text(settingsV.help)
        this.tile_key_setting.set_tooltip_text(settingsV.help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(combo);

    return hbox;
}

function _tileKeySettingChanged() {
    let _popUp = new Gtk.MessageDialog ({
          transient_for: this._window,
          modal: true,
          buttons: Gtk.ButtonsType.OK,
          message_type: Gtk.MessageType.INFO,
          text: this.tile_key_setting.get_active_text() + " index: " + this.tile_key_setting.get_active()});
      // Show the messagedialog
    _popUp.show();
    gsettings.set_string(settingsId, this.tile_key_setting.get_active_text());
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
