
// Receipt of new list of targets, selected target update.
const selectedTarget = document.getElementById('selectedTarget');
selectedTarget.onchange = async function () {
    Blockly.Events.recordUndo = false;
    await Scratch.vm.setEditingTarget(this.value);
    Blockly.Events.recordUndo = true;
};