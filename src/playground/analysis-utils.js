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
            "type": analysisType
        },
        body: xml,
    }).then(res => res.json());

    return analysisInfo;
};



const getAnalysisInfo = async function ({ projectId, analysisType, evalMode }) {
    let analysisResult = await sendAnalysisRequest({ projectId, analysisType, evalMode });
    if (analysisResult.error) {
        throw analysisResult.error;
    }

    return analysisResult;    
}

const getProjectXml = async function (id) {
    let xml = await fetch(`${PROJECT_DATA_SERVICE_URL}/${id}/project.xml`).then(resp => resp.text());
    return xml;
};

const generateInstanceOptionDom = async function (selectionDom, keyValueData, onOptionChageCallBackCreator) {
    for (let valueObj of Object.values(keyValueData)) {
        const refactorable = document.createElement('option');
        refactorable.setAttribute('value', valueObj.id);

        refactorable.appendChild(
            document.createTextNode(valueObj.id)
        );

        selectionDom.appendChild(refactorable);
    }
    selectionDom.onchange = onOptionChageCallBackCreator(keyValueData, selectionDom);
};

const populateActions = async function (actions) {

    let actionSelectionDom = document.getElementById('actions');
    while (actionSelectionDom.firstChild) { //clear
        actionSelectionDom.removeChild(actionSelectionDom.firstChild);
    }

    for (let actionIdx = 0; actionIdx < actions.length; actionIdx++) {
        let action = actions[actionIdx];
        const changeItem = document.createElement('option');
        changeItem.setAttribute('value', actionIdx);
        changeItem.appendChild(document.createTextNode(action.type));
        actionSelectionDom.appendChild(changeItem);
    }

    actionSelectionDom.onchange = async function () {
        console.log('TODO: undo previous transformation first');

        let actionIdx = this.value;
        let action = actions[actionIdx];
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

const populateWalkThru = function (improvable) {
    // populate changes walk through
    let changesWalkThrough = document.getElementById('changesWalkThrough');
    while (changesWalkThrough.firstChild) { //clear
        changesWalkThrough.removeChild(changesWalkThrough.firstChild);
    }

    if (improvable.transforms.length != 0) {
        let createdBlockActions = improvable.transforms.filter((itm) => itm.type === 'BlockCreateAction')
        for (var action of createdBlockActions) {
            const changeItem = document.createElement('option');
            changeItem.setAttribute('value', action.blockId);
            changeItem.appendChild(
                document.createTextNode(action.info + ": " + action.blockId)
            );
            changesWalkThrough.appendChild(changeItem);
        }
    } else {
        // in debug/eval mode walkthru smells
        for (var blockId of improvable.smells) {
            const changeItem = document.createElement('option');
            changeItem.setAttribute('value', blockId);
            changeItem.appendChild(
                document.createTextNode(blockId)
            );
            changesWalkThrough.appendChild(changeItem);
        }
    }


    changesWalkThrough.onchange = function () {
        let id = this.value;
        Blockly.getMainWorkspace().centerOnBlock(id);
        setTimeout(() => {
            Blockly.getMainWorkspace().reportValue(id, id);
        }, 500)
    }

};

function getAllUrlParams(url) {

  // get query string from url (optional) or window
  var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // we'll store the parameters here
  var obj = {};

  // if query string exists
  if (queryString) {

    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split('#')[0];

    // split our query string into its component parts
    var arr = queryString.split('&');

    for (var i = 0; i < arr.length; i++) {
      // separate the keys and the values
      var a = arr[i].split('=');

      // set parameter name and value (use 'true' if empty)
      var paramName = a[0];
      var paramValue = typeof (a[1]) === 'undefined' ? true : a[1];

      // (optional) keep case consistent
      paramName = paramName.toLowerCase();
      if (typeof paramValue === 'string') paramValue = paramValue.toLowerCase();

      // if the paramName ends with square brackets, e.g. colors[] or colors[2]
      if (paramName.match(/\[(\d+)?\]$/)) {

        // create key if it doesn't exist
        var key = paramName.replace(/\[(\d+)?\]/, '');
        if (!obj[key]) obj[key] = [];

        // if it's an indexed array e.g. colors[2]
        if (paramName.match(/\[\d+\]$/)) {
          // get the index value and add the entry at the appropriate position
          var index = /\[(\d+)\]/.exec(paramName)[1];
          obj[key][index] = paramValue;
        } else {
          // otherwise add the value to the end of the array
          obj[key].push(paramValue);
        }
      } else {
        // we're dealing with a string
        if (!obj[paramName]) {
          // if it doesn't exist, create property
          obj[paramName] = paramValue;
        } else if (obj[paramName] && typeof obj[paramName] === 'string'){
          // if property does exist and it's a string, convert it to an array
          obj[paramName] = [obj[paramName]];
          obj[paramName].push(paramValue);
        } else {
          // otherwise add the property
          obj[paramName].push(paramValue);
        }
      }
    }
  }

  return obj;
}