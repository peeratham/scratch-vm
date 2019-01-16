const analysis_data_endpoint_url = DUPEXPR_INFO_SERVICE_URL;

window.onhashchange = function () {
    location.reload();
};

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
//     const {id,type, failed_invariant, info, applicability, value, safety, responsiveness} = updatedInstanceInfos[instance_id];
//     updatedInstanceInfos[instance_id] = {id,type, failed_invariant, info, applicability, value, safety, responsiveness};
}


const createAnalysisTask = function (vm, projectId, callback) {
    // separate smell analysis from refactoring analysis
    // server (smell instance -> smell request -> refactoring transformations)
    console.log('TODO: get smell results from database if available');
    return async function () {
        let projectXml = await getProjectXml(projectId);
        let analysisInfo;
        try{
            analysisInfo = await getAnalysisInfo({
                projectId, projectXml,
                analysisType: getAnalysisTypeFromURL(), //smell analysis
                computeRefactoring: false, 
                evalMode: true
            });
        }catch(err){
            console.log('TODO: tag the analysis record for this id as error and shows on the page');
            return;
        }

        const instanceSelectionDom = document.getElementById('instances');
        generateInstanceOptionDom(instanceSelectionDom, analysisInfo['instances'], createOnChangeCallback);
        
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

const applyTransformations = async function(transforms, report) {
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

const createOnChangeCallback = function(refactorableData, instanceSelectionDom){
    return async () => {
        let improvable = refactorableData[instanceSelectionDom.value];
        console.log('TODO: SHOULD AUGMENT additional attribute here');
        improvable.applicability = {};
        improvable.value = {};
        improvable.safety = {};
        improvable.responsiveness = {};

        console.log('TODO: populate walkThru');
        populateWalkThru(improvable);

        //augment applicability
        console.log('TODO: get failed precond info from server response');
        updateResult(improvable, 'applicability', {
            applicable: improvable.transforms? improvable.transforms.length > 0: false,
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
        
    };
};

const getReadableTypeFromURL = function(){
    let urlTypeArg = findGetParameter('type');
    let typeMap = {
        'magic-value': 'magic-value',
        'code-dup':'code-dup',
        'sprite-dup':  'sprite-dup',
        'seq-dup': 'seq-dup',
        'broad-var': 'broad-var'
    };

    return typeMap[urlTypeArg]||'Unknown';
}

const getAnalysisTypeFromURL = function(){
    let urlTypeArg = findGetParameter('type');
    let typeMap = {
        'magic-value': 'magic-value',
        'code-dup':'code-dup',
        'sprite-dup':  'sprite-dup',
        'seq-dup': 'seq-dup',
        'broad-var': 'broad-var'
    };

    return typeMap[urlTypeArg]||'Unknown';
}

function findGetParameter(parameterName) {
    var result = null,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
          tmp = item.split("=");
          if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
}

window.onload = function () {
    const projectIdDom = document.getElementById("projectId");
    const analysisTypeHeader = document.getElementById("analysisType");
    analysisTypeHeader.innerText = getReadableTypeFromURL();
    
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
        wsReadyCallback: createAnalysisTask(vm, projectId, function () { updateStatus(projectId, getAnalysisTypeFromURL() , 'COMPLETE') })
    });
}

