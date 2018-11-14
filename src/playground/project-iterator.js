
const frame = document.getElementsByTagName('iframe')[0];

let dom = document.createElement('div');
document.getElementsByClassName('suite-results')[0].appendChild(dom);

const sleep = m => new Promise(r => setTimeout(r, m));

function summaryText(total,incomplete){
    const divEl = document.createElement('div');
    divEl.innerText = `Total: ${total}, Incomplete: ${incomplete}`;
    return divEl;
}

const limitPerPage = 1;
const getProjects = async function () {
    const projects = await fetch("http://localhost:3000/projects").then(resp => resp.json());
    const incompleteProjects = [];


    let projectIdx = 0;
    do {
        let p = projects[projectIdx];
        const projectDataInfo = await fetch(`http://localhost:3000/data/${p._id}`).then(resp=>resp.json());
        const textHeader = document.createElement('div');
        if(!projectDataInfo['project_dir_exists']){
            textHeader.innerText = p._id + " : incomplete";
            incompleteProjects.push(p);
        }else{
            textHeader.innerText = p._id + " : complete";
        }
        dom.appendChild(textHeader);

        projectIdx++;
    } while (projectIdx < projects.length);

    dom.prepend(summaryText(projects.length,incompleteProjects.length));

    window.addEventListener("message", function (message) {
        const { project_id, type } = message.data;
        
        if (type === "NEXT"||type==="START") {
            if(type==="NEXT"){console.log("Done: "+project_id)};
            if (incompleteProjects.length > 0) {
                let nextProject = incompleteProjects.shift();
                frame.contentWindow.location.assign(`executor.html#${nextProject._id}`);
            }
        }
    });

    //start!
    window.parent.postMessage({
        type: 'START'
    }, '*');

}

window.onload = function () {
    getProjects();
}





