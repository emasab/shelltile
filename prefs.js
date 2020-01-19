const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;
const Gettext = imports.gettext.domain('shelltile');
const _ = Gettext.gettext;

const SCHEMA = "org.gnome.shell.extensions.shelltile";

var gsettings;
var settings;

function init(){
    Convenience.initTranslations();

    gsettings = Convenience.getSettings();

    settings = {
        "enable-edge-tiling": {
            type: "b",
            label: _("Enable edge tiling")
        },
        "grouping-edge-tiling": {
            type: "b",
            label: _("Grouping edge tiling")
        },
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
            max: 50,
            step: 1
        },
        "edge-zone-width": {
            type: "i",
            label: _("Size of active edge tiling zone"),
            min: 1,
            max: 50,
            step: 1
        },
        "tile-modifier-key": {
            type: "s",
            label: _("Key to hold for tiling")
        },
        "enable-keybindings": {
            type: "b",
            label: _("Enable keybindings")
        },
        "tile-left": {
            type: "as",
            label: _("Tile to the left edge")
        },
        "tile-right": {
            type: "as",
            label: _("Tile to the right edge")
        },
        "tile-up": {
            type: "as",
            label: _("Tile to the top edge")
        },
        "tile-down": {
            type: "as",
            label: _("Tile to the bottom edge")
        }
    };

}

function getAccelerators(){
    return [
        "tile-left",
        "tile-right",
        "tile-up",
        "tile-down"
    ]
}

function buildPrefsWidget(){

    let frame = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        border_width: 10
    });
    let vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin: 20,
        margin_top: 10
    });

    let hbox;
    for (setting in settings){
        hbox = buildHbox(settings, setting);
        if(hbox) vbox.add(hbox);
    }

    let keybindingWidget = createKeybindingWidget(gsettings);
    vbox.add(keybindingWidget);
    for (setting in settings){
        let settingV = settings[setting];
        if(settingV.type == "as"){
            addKeybinding(keybindingWidget.model, gsettings, setting, settingV.label);
        }
    }

    frame.add(vbox);
    frame.show_all();

    return frame;

}

function buildHbox(settings, setting){
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
function createStringSetting(settings, setting){

    let settingsV = settings[setting];
    let settingsId = setting;

    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_top: 5
    });

    let setting_label = new Gtk.Label({
        label: settingsV.label,
        xalign: 0,
        hexpand: true,
        margin_right: 20
    });

    // This is to add the 'combo' filtering options
    store = new Gtk.ListStore();
    store.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);
    store.set(store.append(), [0], ['Ctrl']);
    store.set(store.append(), [0], ['Super']);
    store.set(store.append(), [0], [_('Ctrl or Super')]);

    combo = new Gtk.ComboBox({
        model: store
    });
    renderer = new Gtk.CellRendererText();
    combo.pack_start(renderer, false);
    combo.add_attribute(renderer, "text", 0);
    combo.set_active(0);
    let previousValue = gsettings.get_string(settingsId);
    if (previousValue === 'Super')
        combo.set_active(1);
    if (previousValue === 'Ctrl or Super')
        combo.set_active(2);

    combo.connect('changed', (widget) => {
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

    if (settingsV.help){
        setting_label.set_tooltip_text(settingsV.help)
        this.tile_key_setting.set_tooltip_text(settingsV.help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(combo);

    return hbox;
}

function _tileKeySettingChanged(){
    let _popUp = new Gtk.MessageDialog({
        transient_for: this._window,
        modal: true,
        buttons: Gtk.ButtonsType.OK,
        message_type: Gtk.MessageType.INFO,
        text: this.tile_key_setting.get_active_text() + " index: " + this.tile_key_setting.get_active()
    });
    // Show the messagedialog
    _popUp.show();
    gsettings.set_string(settingsId, this.tile_key_setting.get_active_text());
}

function createBoolSetting(settings, setting){

    let settingsV = settings[setting];
    let settingsId = setting;

    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_top: 5
    });

    let setting_label = new Gtk.Label({
        label: settingsV.label,
        xalign: 0,
        hexpand: true,
        margin_right: 20
    });

    let setting_switch = new Gtk.Switch({
        active: gsettings.get_boolean(settingsId)
    });
    setting_switch.connect('notify::active', function (button){
        gsettings.set_boolean(settingsId, button.active);
    });

    if (settingsV.help){
        setting_label.set_tooltip_text(settingsV.help)
        setting_switch.set_tooltip_text(settingsV.help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_switch);

    return hbox;
}

function createIntSetting(settings, setting){

    let settingsV = settings[setting];
    let settingsId = setting;

    let hbox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        margin_top: 5
    });

    let setting_label = new Gtk.Label({
        label: settingsV.label,
        xalign: 0,
        hexpand: true,
        margin_right: 20
    });

    let adjustment = new Gtk.Adjustment({
        lower: settingsV.min || 0,
        upper: settingsV.max || 65535,
        step_increment: settingsV.step || 1
    });
    let setting_int = new Gtk.SpinButton({
        adjustment: adjustment,
        snap_to_ticks: true
    });
    setting_int.set_value(gsettings.get_int(settingsId));
    setting_int.connect('value-changed', function (entry){
        gsettings.set_int(settingsId, entry.value);
    });

    if (settingsV.help){
        setting_label.set_tooltip_text(settingsV.help)
        setting_int.set_tooltip_text(settingsV.help)
    }

    hbox.pack_start(setting_label, true, true, 0);
    hbox.add(setting_int);

    return hbox;
}

const COLUMN_ID          = 0;
const COLUMN_DESCRIPTION = 1;
const COLUMN_KEY         = 2;
const COLUMN_MODS        = 3;

function addKeybinding(model, settings, id, description){
    // Get the current accelerator.
    let accelerator = settings.get_strv(id)[0];
    let key, mods;
    if (accelerator == null)
        [key, mods] = [0, 0];
    else
        [key, mods] = Gtk.accelerator_parse(settings.get_strv(id)[0]);

    // Add a row for the keybinding.
    let row = model.insert(100); // Erm...
    model.set(row,
        [COLUMN_ID, COLUMN_DESCRIPTION, COLUMN_KEY, COLUMN_MODS],
        [id,        description,        key,        mods]);
}

function createKeybindingWidget(settings){
    let model = new Gtk.ListStore();

    model.set_column_types(
        [GObject.TYPE_STRING, // COLUMN_ID
            GObject.TYPE_STRING, // COLUMN_DESCRIPTION
            GObject.TYPE_INT,    // COLUMN_KEY
            GObject.TYPE_INT]);  // COLUMN_MODS

    let treeView = new Gtk.TreeView();
    treeView.model = model;
    treeView.headers_visible = false;

    let column, renderer;

    // Description column.
    renderer = new Gtk.CellRendererText();

    column = new Gtk.TreeViewColumn();
    column.expand = true;
    column.pack_start(renderer, true);
    column.add_attribute(renderer, "text", COLUMN_DESCRIPTION);

    treeView.append_column(column);

    // Key binding column.
    renderer = new Gtk.CellRendererAccel();
    renderer.accel_mode = Gtk.CellRendererAccelMode.GTK;
    renderer.editable = true;

    renderer.connect("accel-edited",
        function (renderer, path, key, mods, hwCode){
            let [ok, iter] = model.get_iter_from_string(path);
            if(!ok)
                return;

            // Update the UI.
            model.set(iter, [COLUMN_KEY, COLUMN_MODS], [key, mods]);

            // Update the stored setting.
            let id = model.get_value(iter, COLUMN_ID);
            let accelString = Gtk.accelerator_name(key, mods);
            settings.set_strv(id, [accelString]);
        });

    renderer.connect("accel-cleared",
        function (renderer, path){
            let [ok, iter] = model.get_iter_from_string(path);
            if(!ok)
                return;

            // Update the UI.
            model.set(iter, [COLUMN_KEY, COLUMN_MODS], [0, 0]);

            // Update the stored setting.
            let id = model.get_value(iter, COLUMN_ID);
            settings.set_strv(id, []);
        });

    column = new Gtk.TreeViewColumn();
    column.pack_end(renderer, false);
    column.add_attribute(renderer, "accel-key", COLUMN_KEY);
    column.add_attribute(renderer, "accel-mods", COLUMN_MODS);

    treeView.append_column(column);

    return treeView;
}