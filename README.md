# ShellTile

*Hi, if you like the extension please consider offering me a remote work opportunity. I live in Spain currently so my salary expectations are low if compared to other countries. My Linkedin profile: https://www.linkedin.com/in/emanuele-sabellico-2bb53016/*

A tiling window extension for GNOME Shell. Just move a window over another one, holding down the Control key, and you'll see the magic! Grouped windows minimize, resize, raise and change workspace together. Maximize a window to remove it from the group.

### Example of tiling with multiple windows (holding CTRL)

![tiling windows](/README/img/window_tiling.gif)

### Example of classic edge resizing (CTRL not needed)

![tiling windows](/README/img/edge_tiling.gif)

### Example of how windows stay grouped

![tiling windows](/README/img/coordinated_actions.gif)

### Tutorial video

https://www.youtube.com/watch?v=xX9HUBFj5XE
thanks to WOGUE

## Notes.
### Ubuntu 18.04
Ubuntu 18.04 comes with a basic tiling behavior, so you will have problems using both at the same time.
The faster workaround is to disable the default one:
```
dconf write /org/gnome/mutter/edge-tiling false
dconf write /org/gnome/shell/overrides/edge-tiling false
```
