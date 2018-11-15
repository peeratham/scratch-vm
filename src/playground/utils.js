//debugging utitlity
const xmlButton = document.getElementById('getTargetXml');
if(xmlButton){
    xmlButton.addEventListener("click", function () {
        let xml = Scratch.vm.editingTarget.blocks.toXML();
        let str = xml.replace(/\s+/g, ' '); // Keep only one space character
        str = str.replace(/>\s*/g, '>');  // Remove space after >
        str = str.replace(/\s*</g, '<');  // Remove space before <
        str = str.replace(/"/g, "'");   //replace double quotes with single quotes
        console.log(str);
    });    
}

const blockXmlButton = document.getElementById('getBlockXml');
if(blockXmlButton){
    blockXmlButton.addEventListener("click", function () {
        if(Blockly.selected){
            let block = Blockly.selected;
            let dom = Blockly.Xml.blockToDom(block);
            let xml = Blockly.Xml.domToText(dom);
            let str = xml.replace(/\s+/g, ' '); // Keep only one space character
            str = str.replace(/>\s*/g, '>');  // Remove space after >
            str = str.replace(/\s*</g, '<');  // Remove space before <
            str = str.replace(/"/g, "'"); //replace double quotes with single quotes
            console.log(str);
        }
    });
}

const blockIdToFocusInputBox = document.getElementById('blockIdToFocusTextInput');
const centerOnBlockButton = document.getElementById('centerOnBlockButton');
centerOnBlockButton.addEventListener("click", function(){
    let id = blockIdToFocusInputBox.value;
    Blockly.getMainWorkspace().centerOnBlock(id);
    setTimeout(function(){
        Blockly.getMainWorkspace().reportValue(id,id);
    },500)
});

const cleanUpButton = document.getElementById("cleanup");
cleanUpButton.addEventListener("click", function(){
    Scratch.workspace.cleanUp();
});

const greenFlagButton = document.getElementById("greenFlag");
greenFlagButton.addEventListener("click", function(){
    Scratch.vm.runtime.start();
    Scratch.vm.runtime.greenFlag();
});

const stopButton = document.getElementById("stop");
stopButton.addEventListener("click", function(){
    Scratch.vm.stopAll();
});

function taChange() {
    var textarea = document.getElementById('importExport');
    if (sessionStorage) {
      sessionStorage.setItem('textarea', textarea.value)
    }
    var valid = true;
    try {
      Blockly.Xml.textToDom(textarea.value);
    } catch (e) {
      valid = false;
    }
    document.getElementById('import').disabled = !valid;
}

function toXml() {
    var output = document.getElementById('importExport');
    var xml = Blockly.Xml.workspaceToDom(Scratch.workspace);
    output.value = Blockly.Xml.domToPrettyText(xml);
    output.focus();
    output.select();
    taChange();
}

function fromXml() {
    var input = document.getElementById('importExport');
    var xml = Blockly.Xml.textToDom(input.value);
    Blockly.Xml.domToWorkspace(xml, Scratch.workspace);
    taChange();
}

function readVar(varName) {
    console.log(Scratch.vm.runtime.getTargetForStage().variables[varName].value);
}
