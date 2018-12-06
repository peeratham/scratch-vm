const setupAnalysisUI = ({ vm }) => {
    vm.on('targetsUpdate', data => {
        // Clear select box.
        while (selectedTarget.firstChild) {
            selectedTarget.removeChild(selectedTarget.firstChild);
        }
        // Generate new select box.
        for (let i = 0; i < data.targetList.length; i++) {
            const targetOption = document.createElement('option');
            targetOption.setAttribute('value', data.targetList[i].id);
            // If target id matches editingTarget id, select it.
            if (data.targetList[i].id === data.editingTarget) {
                targetOption.setAttribute('selected', 'selected');
            }
            targetOption.appendChild(
                document.createTextNode(data.targetList[i].name)
            );
            selectedTarget.appendChild(targetOption);
        }
    });

    const selectedTarget = document.getElementById('selectedTarget');
    selectedTarget.onchange = async function () {
        Blockly.Events.recordUndo = false;
        await vm.setEditingTarget(this.value);
        Blockly.Events.recordUndo = true;
    };

    console.log('TODO: add instance list');
}

// =====ANALYSIS UI UTILS=============
const switchTarget =  async function(refactoringTarget) {
    if (Scratch.vm.editingTarget.getName() != refactoringTarget) {
        console.log("switch target to:" + refactoringTarget);
        let targetId = Scratch.vm.runtime.targets.filter(t => t.getName() === refactoringTarget)[0].id;
        Blockly.Events.recordUndo = false;
        await Scratch.vm.setEditingTarget(targetId);
        Blockly.Events.recordUndo = true;
    }
}