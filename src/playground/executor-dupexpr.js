/**
 * DUPEXPR ANALYSIS
 */

const analysis_data_endpoint_url = DUPEXPR_INFO_SERVICE_URL;

window.onhashchange = function () {
    location.reload();
};

const sendAnalysisRequest = async function ({ projectId, analysisType, evalMode }) {
    const url = "http://localhost:8080/discover";
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

const getAnalysisInfo = async function ({ projectId, url, projectXml, analysisType, evalMode }) {
    let analysisResult = await sendAnalysisRequest({ projectId, url, projectXml, analysisType, evalMode });
    let formatted = formatResult({ projectId, analysisResult });

    return formatted;
}

const getProjectXml = async function (id) {
    let xml = await fetch(`${PROJECT_DATA_SERVICE_URL}/${id}/project.xml`).then(resp => resp.text());
    return xml;
}

const updateResult = function(objTarget, attributeName, objSource){
  objTarget[attributeName] = objSource;  
};

const setupAndRunProfiler = async function ({ instance_id, analysisInfo }) {
    let updatedInstanceInfos = analysisInfo['instances'];
    let currentInstance = updatedInstanceInfos[instance_id];
    
    
    let profilerRun = Scratch.ProfileRun = new ProfilerRun({
        vm: Scratch.vm, warmUpTime: 0, maxRecordedTime: 5000, projectId: Project.ID, initialReport: {},
        coverageInfo: currentInstance.coverageInfo
    });
    await profilerRun.runProfiler();

    console.log('TODO: CREATE A METHOD FOR UPDATE');
    updateResult(updatedInstanceInfos[instance_id], 'safety', profilerRun.report);

    // include only necessary details in the final result (only save the loc of instance);
    const {id,type, failed_invariant, info, applicability, value, safety, responsiveness} = updatedInstanceInfos[instance_id];
    updatedInstanceInfos[instance_id] = {id,type, failed_invariant, info, applicability, value, safety, responsiveness};
}

const createAnalysisTask = function (vm, projectId, callback) {
    return async function () {
        let projectXml = await getProjectXml(projectId);
        //project metric info
        console.log('TODO: getAnalysisInfo from improvement discovery url');
        let analysisInfo = await getAnalysisInfo({
            projectId, url: `${COVERAGE_ANALYSIS_SERVICE_URL}/${projectId}`, projectXml,
            analysisType: "duplicate-expression", evalMode: true
        });

        const instanceSelectionDom = document.getElementById('instances');
        renderRefactorableList(instanceSelectionDom, analysisInfo);
        
        for (let i = 0; i < instanceSelectionDom.length; i++) {
            instanceSelectionDom.selectedIndex = i;
            instanceSelectionDom.dispatchEvent(new Event('change'));
            let instance_id = instanceSelectionDom.value;
            let improvable = analysisInfo.instances[instance_id];
            console.log('TODO: reformat value');
            updateResult(improvable, 'value', {num_blocks_changed:improvable.info.num_blocks_changed});

            if(improvable.transforms.length>0){
                await setupAndRunProfiler({ providedVM: vm, instance_id, analysisInfo });
            }
        }

        
        console.log('TODO: comment/uncomment below to disable/enable save');
        let result = {
            '_id': analysisInfo._id,
            'analysis_name': 'dupexpr',
            'info': {
                'project_metrics': analysisInfo.project_metrics,
                'instances': analysisInfo.instances
            }
         };
        
        console.log(JSON.stringify(result));
        
        // await saveAnalysisInfo({info: result, analysis_data_endpoint_url});
    }
}

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

const applyTransformations = async function(transforms, report) {
    console.log('TODO: do not record transforms data on invariant insertion');
    Blockly.Events.recordUndo = true;
    //START timer
    const t0 = performance.now();

    if(!Array.isArray(transforms)){
        console.log('DEBUG: NOT ITERABLE');
    }
    for (var action of transforms) {
        try {
            await Scratch.workspace.blockTransformer.executeAction(action);
            //synchronous for now to make sure vm update its internal representation correclty in sequence of the applied transformation
            await Blockly.Events.fireNow_();
        } catch (err) {
            console.log("Failed transformation:" + JSON.stringify(action));
            throw err;
        }
    }
    //STOP timer
    const t1 = performance.now();

    if(report){
        report.resp_time = t1 - t0;
        report.num_transforms = transforms.length;    
    }
}

const setupInvariantChecks = function(setupObj,invChecks){
    let actions = setupObj['actions'];
    (async () => {
            await applyTransformations(actions);
            await applyTransformations(invChecks);
    })();
}


const renderRefactorableList = async function(instanceSelectionDom, json){
    if (json.error != null) {
        console.log(JSON.stringify(json.error));
        return;
    }else{
        Scratch.json = json; 
    }
    
    var refactorableData = json['instances'];
    console.log('TODO: sort instnaces based on transformation length');
    for(let instance of Object.values(refactorableData)){
        const refactorable = document.createElement('option');
        refactorable.setAttribute('value', instance.id);

        refactorable.appendChild(
            document.createTextNode(instance.target + ":" + instance.id)
        );

        instanceSelectionDom.appendChild(refactorable);
    }

    instanceSelectionDom.onchange = async () => {
        let improvable = refactorableData[instanceSelectionDom.value];
        console.log('TODO: SHOULD AUGMENT additional attribute here');
        improvable.applicability = {};
        improvable.value = {};
        improvable.safety = {};
        improvable.responsiveness = {};

        //augment applicability
        console.log('TODO: get failed precond info from server response');
        updateResult(improvable, 'applicability', {
            applicable: improvable.transforms.length > 0,
            failed_preconds : []
        });

        //cleaning up previous transformations
        while (Scratch.workspace.hasUndoStack()) {
            await Scratch.workspace.undo();
            await Blockly.Events.fireNow_();
        }

        let refactoringTarget = improvable["target"];
        await switchTarget(refactoringTarget);
        
        if(improvable.transforms.length>0){
            let responsivenessResult = {};
            await applyTransformations(improvable.transforms, responsivenessResult);
            updateResult(improvable,'responsiveness', responsivenessResult);
            await setupInvariantChecks(json['checkSetup'], improvable.invariants);
            return;
        }else{
            return;
        }
        
        console.log('TODO: populate walkThru');
        // populateWalkThru(improvable);
        
        //populate field to report safety evaluation data
        const failButton = document.getElementById("markAsFailButton");
        const comment = document.getElementById("comment");
        
        
    };
};

window.onload = function () {
    const projectIdDom = document.getElementById("projectId");
    let projectId = projectIdDom.innerText = location.hash.substring(1, location.hash.length);
    configureProjectResourceUrl({ LOCAL_ASSET: true });

    const vm = new window.VirtualMachine();
    const requiredAnalysisUi = true;
    if (requiredAnalysisUi) {
        setupAnalysisUI({ vm });
    }

    loadProjectAndRunTask({
        providedVM: vm,
        projectId,
        wsReadyCallback: createAnalysisTask(vm, projectId, function () { updateStatus(projectId, 'DUPEXPR', 'COMPLETE') })
    });
}

