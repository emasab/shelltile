# ShellTile

A tiling window extension for GNOME Shell. Just move a window to the edges of the screen to create a tiling, otherwise move a window over another one, holding down the Control key. Grouped windows minimize, resize, raise and change workspace together. Move or maximize a window to remove it from the group.

*WARNING: doesn't work with Wayland yet. Follow up: https://github.com/emasab/shelltile/issues/98*

### Grouping edge tiling

Before, when using the screen borders, only a move and resize was made. Instead, if holding Ctrl, you could group windows together. Now you can still group windows with Ctrl, but they are grouped when you use the screen borders too (if a valid tiling can be generated with the topmost window already edge-tiled). You can disable the new behavior in the extension setting.

A video is the best way to explain it:

[Video on YouTube](https://www.youtube.com/watch?v=hNncF9Pc6PY)

### Installation
https://extensions.gnome.org/extension/657/shelltile/

**Keyboard accelerators:**

Default keyboard accelerators that can be joined for quarter tiling:

* &lt;Ctrl&gt;&lt;Super&gt;Left : Tile to the left border
* &lt;Ctrl&gt;&lt;Super&gt;Right : Tile to the right border
* &lt;Ctrl&gt;&lt;Super&gt;Up : Tile to the top border
* &lt;Ctrl&gt;&lt;Super&gt;Down : Tile to the bottom border

### Example of tiling with multiple windows (holding CTRL)

![tiling windows](/README/img/window_tiling.gif)

### Example of how windows stay grouped

![tiling windows](/README/img/coordinated_actions.gif)

### Tutorial video

https://www.youtube.com/watch?v=xX9HUBFj5XE
thanks to WOGUE
