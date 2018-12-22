const sendAnalysisRequest = async function ({ projectId, analysisType, evalMode }) {
    const url = REFACTORING_SERVICE_URL;
    const xml = await getProjectXml(projectId);

    const analysisInfo = await fetch(url, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        headers: {
            "Content-Type": "text/xml",
            "id": projectId,
            "type": analysisType,
            'evalMode': evalMode
        },
        body: xml,
    }).then(res => res.json());

    return analysisInfo;
};

const formatResult = function ({ projectId, analysisResult }) {
    let instanceMap = analysisResult.improvables.reduce((obj, item) => {
        if (item) { //ignore if undefined (data for the projectId not exists)
            obj[item.id] = item;
        }
        return obj;
    }, {});

    let result = {
        _id: projectId,
        instances: instanceMap,
        project_metrics: analysisResult.project_metrics,
        checkSetup: analysisResult.checkSetup
    };
    return result;
}

const getAnalysisInfo = async function ({ projectId, projectXml, analysisType, evalMode }) {
    let analysisResult = await sendAnalysisRequest({ projectId, projectXml, analysisType, evalMode });
    let formatted = formatResult({ projectId, analysisResult });
    return formatted;
}

const getProjectXml = async function (id) {
    let xml = await fetch(`${PROJECT_DATA_SERVICE_URL}/${id}/project.xml`).then(resp => resp.text());
    return xml;
};

const generateInstanceOptionDom = async function(selectionDom, keyValueData, onOptionChageCallBackCreator){
    for(let valueObj of Object.values(keyValueData)){
        const refactorable = document.createElement('option');
        refactorable.setAttribute('value', valueObj.id);

        refactorable.appendChild(
            document.createTextNode(valueObj.id)
        );

        selectionDom.appendChild(refactorable);
    }
    selectionDom.onchange = onOptionChageCallBackCreator(keyValueData, selectionDom);
};

const populateActions = function(refactorable){
   
    let actionSelectionDom = document.getElementById('actions');
    while (actionSelectionDom.firstChild) { //clear
        actionSelectionDom.removeChild(actionSelectionDom.firstChild);
    }

    for(let actionIdx=0; actionIdx < refactorable.transforms.length; actionIdx++){
        let action = refactorable.transforms[actionIdx];
        const changeItem = document.createElement('option');
        changeItem.setAttribute('value', actionIdx);
        changeItem.appendChild(document.createTextNode(action.type));
        actionSelectionDom.appendChild(changeItem);
    }

    actionSelectionDom.onchange = async function() {
        console.log('TODO: undo previous transformation first');

        let actionIdx = this.value;
        let action = refactorable.transforms[actionIdx];
        console.log('TODO: apply transformation actions:' + JSON.stringify(action));
        try {
            await Scratch.workspace.blockTransformer.executeAction(action);
            //synchronous for now to make sure vm update its internal representation correclty in sequence of the applied transformation
            await Blockly.Events.fireNow_();
        } catch (err) {
            console.log("Failed transformation:" + JSON.stringify(action));
            throw err;
        }
        
    }

}

const populateWalkThru = function(improvable){
    // populate changes walk through
    let changesWalkThrough = document.getElementById('changesWalkThrough');
    while (changesWalkThrough.firstChild) { //clear
        changesWalkThrough.removeChild(changesWalkThrough.firstChild);
    }
    
    if(improvable.transforms.length!=0){
        let createdBlockActions = improvable.transforms.filter((itm)=>itm.type==='BlockCreateAction')
        for(var action of createdBlockActions){
            const changeItem = document.createElement('option');
            changeItem.setAttribute('value', action.blockId);
            changeItem.appendChild(
                document.createTextNode(action.info + ": "+ action.blockId)
            );
            changesWalkThrough.appendChild(changeItem);
        }
    }else{
        // in debug/eval mode walkthru smells
        for(var blockId of improvable.smells){
            const changeItem = document.createElement('option');
            changeItem.setAttribute('value', blockId);
            changeItem.appendChild(
                document.createTextNode(blockId)
            );
            changesWalkThrough.appendChild(changeItem);
        }
    }
    

    changesWalkThrough.onchange = function() {
        let id = this.value;
        Blockly.getMainWorkspace().centerOnBlock(id);
        setTimeout(()=>{
            Blockly.getMainWorkspace().reportValue(id,id);
        },500)
    }

};