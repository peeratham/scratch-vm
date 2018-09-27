// refactorables
const computed_refactorables = {
    "populate1": {
        "id": "populate1",
        "transforms": [
            {
                "type": "BlockCreateAction",
                "block_xml": "<xml><block type='event_whenflagclicked' id='$qzcZRovdQ?/.].mHhQ%' x='63' y='47'><next><block type='motion_movesteps' id='`}x+~AAoYR)K8AgT$Jf('><value name='STEPS'><shadow xmlns='' type='math_number' id='i+t2}H;AK6]xvomm2L!1'><field name='NUM'>10</field></shadow><block type='operator_add' id='S$ke,BdE{(*byS^NF/)b'><value name='NUM1'><shadow type='math_number' id='o~ikTh6`@9$!=hU?{Otd'><field name='NUM'>1</field></shadow></value><value name='NUM2'><shadow type='math_number' id='VM|FKX@^G%((_CX^/}Rv'><field name='NUM'>2</field></shadow></value></block></value><next><block type='motion_pointindirection' id='y~KDiyE4SpAoS|xtDI#F'><value name='DIRECTION'><shadow xmlns='' type='math_angle' id=']^p?ASOD|3xORhegAmiI'><field name='NUM'>90</field></shadow><block type='operator_add' id='+Ms7c^/)F$:n+qMV6*E,'><value name='NUM1'><shadow type='math_number' id='kA@IM!WF#oWw!X6(hI_f'><field name='NUM'>1</field></shadow></value><value name='NUM2'><shadow type='math_number' id='/qx#_A6HA`8r9rL3Fe~n'><field name='NUM'>2</field></shadow></value></block></value></block></next></block></next></block></xml>"
            }
        ]
    },
    "refactorable_1": {
        "id": "refactorable_1",
        "hint": ["S$ke,BdE{(*byS^NF/)b", "+Ms7c^/)F$:n+qMV6*E,"],
        "transforms": [
            {
                "type": "VarDeclareAction",
                "name": "temp",
                "id": "#|v/]b+8CRJ+!`mFil#`"
            },
            {
                "type": "BlockCreateAction",
                "block_xml": "<xml><block type='data_setvariableto' id='.jEVI^80b1[Kk+^ni0h3' x='65' y='47'><field name='VARIABLE' id='#|v/]b+8CRJ+!`mFil#`' variabletype=''>temp</field><value name='VALUE'><shadow type='text' id='W{jlO2Bf#n^2;)rKT29J'><field name='TEXT'>0</field></shadow><block type='operator_add' id=']Hz9eaJ%IUgQ@}f8Y?fo'><value name='NUM1'><shadow type='math_number' id='meWh7}$dz~KJmp,8290^'><field name='NUM'>1</field></shadow></value><value name='NUM2'><shadow type='math_number' id='1uQ`q#5f6Y,.p4$nQ-12'><field name='NUM'>2</field></shadow></value></block></value></block></xml>",
                "comment": "temp=expr"
            },
            {
                "type": "InsertBlockAction",
                "target_block": "`}x+~AAoYR)K8AgT$Jf(",
                "inserted_block": ".jEVI^80b1[Kk+^ni0h3"
            },
            {
                "type": "BlockCreateAction",
                "block_xml": "<xml><block type='data_variable' id='Hj%m.nh?Y_%+}f/N5Yto' x='-58' y='-51'><field name='VARIABLE' id='#|v/]b+8CRJ+!`mFil#`' variabletype=''>temp</field></block></xml>"
            },
            {
                "type": "ReplaceAction",
                "target_block": "S$ke,BdE{(*byS^NF/)b",
                "replace_with": "Hj%m.nh?Y_%+}f/N5Yto"
            },
            {
                "type": "BlockCreateAction",
                "block_xml": "<xml><block type='data_variable' id='temp_id_2' x='-58' y='-51'><field name='VARIABLE' id='#|v/]b+8CRJ+!`mFil#`' variabletype=''>temp</field></block></xml>"
            },
            {
                "type": "ReplaceAction",
                "target_block": "+Ms7c^/)F$:n+qMV6*E,",
                "replace_with": "temp_id_2"
            }
        ]
    }
};