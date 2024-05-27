"use client"
import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import "./sprints.css"
import {AuthContext} from "../../provider/AuthProvider";
import {
    collection, doc,
    DocumentData, getDoc, increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    where
} from "firebase/firestore";
import {db} from "../../services/Firebase";
import CommandButton from "../../../components/CommandButton/CommandButton";
import {updateDoc} from "@firebase/firestore";
import Sprint from "../../../components/Sprint/Sprint";
import {DndContext, DragOverlay} from '@dnd-kit/core';
import {DroppableList} from '../../../components/DroppableList';
import {DraggableButton} from '../../../components/DraggableButton';
import dayjs from "dayjs";
import Modal from "../../../components/Modal/Modal";

const Sprints = () => {

    const {user}: any = AuthContext();
    const userInfo = user.user;

    const [sprints, setSprints] = useState<DocumentData[]>()
    const [sprintsLimit, setSprintsLimit] = useState<number>(5)
    const [currentCommandId, setCurrentCommandId] = useState("")
    const [commands, setCommands] = useState<DocumentData[]>([])
    const [addSprintState, setAddSprintState] = useState<boolean>(false)
    const [tasksList, setTasksList] = useState<DocumentData[]>([])
    const [selectedTasks, setSelectedTasks] = useState<DocumentData[]>([])
    const [parent, setParent] = useState("listAllTasks");
    const [activeId, setActiveId] = useState(null);
    const [currentTask, setCurrentTask] = useState<DocumentData>({})
    const [surveyPath, setSurveyPath] = useState<string>("")
    const [modalVisible, setModalVisible] = useState(false)
    const [surveyState, setSurveyState] = useState("")
    const [surveyResults, setSurveyResults] = useState<DocumentData[]>([])
    const [surveyUsers, setSurveyUsers] = useState<DocumentData[]>([])
    const [surveyTasks, setSurveyTasks] = useState<DocumentData[]>([])
    const [modalResultVisible, setModalResultVisible] = useState<boolean>(false)

    const sprintsQuery = useMemo(() => {
        return query(collection(db, "users", userInfo?.uid, "sprints"), where("commandId", "==", currentCommandId), orderBy("creationDate", "desc"), limit(sprintsLimit));
    }, [currentCommandId, sprintsLimit, userInfo?.uid])

    const TasksQuery = useMemo(() => {
        return query(collection(db, "users", userInfo?.uid, "tasks"), where("sprint", "==", ""))
    }, [userInfo?.uid])

    const surveyQuery = useMemo(() => {
        return query(collection(db, "users", userInfo?.uid, "survey"), limit(1));
    }, [userInfo?.uid])

    const commandQuery = useMemo(() => {
        return query(collection(db, "users", userInfo?.uid, "commands"))
    }, [userInfo?.uid])

    useEffect(() => {
        const unsubscribe = onSnapshot(sprintsQuery, (snapshot => {
            const updatedSprints = snapshot.docs.map((doc) => doc.data())
            setSprints(updatedSprints);
        }))
        return () => unsubscribe();
    }, [sprintsQuery])

    useEffect(() => {
        const unsubscribe = onSnapshot(commandQuery, (snapshot => {
            const updatedCommand = snapshot.docs.map((doc) => doc.data())
            setCommands(updatedCommand);
        }))
        return () => unsubscribe();
    }, [commandQuery])

    useEffect(() => {
        const unsubscribe = onSnapshot(TasksQuery, (snapshot => {
            const updatedTasks = snapshot.docs.map((doc) => doc.data())
            setTasksList(updatedTasks);
            setSelectedTasks([]);
        }))
        return () => unsubscribe();
    }, [TasksQuery])

    useEffect(() => {
        const unsubscribe = onSnapshot(surveyQuery, (snapshot => {
            const updatedSurvey = snapshot.docs[0].data()
            setSurveyResults(updatedSurvey.userScore)
            setSurveyUsers(updatedSurvey.users)
            setSurveyTasks(updatedSurvey.selectedTasks)
            if (!updatedSurvey.completed) {
                setSurveyState("created")
            }
        }))
        return () => unsubscribe();
    }, [surveyQuery])

    useEffect(() => {
        console.log('surveyTasks', JSON.stringify(surveyTasks, null, 2));
    }, [surveyTasks]);

    useEffect(() => {
        setAddSprintState(false)
    }, [currentCommandId])

    const renderCommand = useCallback((command: DocumentData) => {
        return <CommandButton key={command.id} CommandId={command.id} CommandName={command.name}
                              onTaskClickFunc={setCurrentCommandId}/>
    }, [])

    const renderSprint = useCallback((sprint: DocumentData) => {
        return <Sprint sprint={sprint} userUID={userInfo?.uid} key={sprint.id} taskClickFunc={setCurrentTask}
                       taskClickSetView={setAddSprintState}/>
    }, [userInfo?.uid])

    const renderTask = useCallback((task: DocumentData) => {
        return <DraggableButton key={task.id} id={task.id} name={task.name} score={task.score}/>
    }, [])

    function handleDragStart(event: any) {
        setActiveId(event.active.id);
    }

    function handleDragEnd(event: any) {
        const {over} = event;
        setParent(over ? over.id : null);
        let selectedTask: DocumentData = {};

        if (selectedTasks.map((task) => (task.id)).includes(activeId)) {
            selectedTask = selectedTasks.find((task) => task.id === activeId) || {}
            setSelectedTasks(selectedTasks.filter((task) => (task.id != activeId)))
        }
        if (tasksList.map((task) => (task.id)).includes(activeId)) {
            selectedTask = tasksList.find((task) => task.id === activeId) || {}
            setTasksList(tasksList.filter((task) => (task.id != activeId)))
        }
        if (over?.id === "listSelectedTasks") {
            setSelectedTasks(selectedTasks => [...selectedTasks, selectedTask])
        }
        if (over?.id === "listAllTasks") {
            setTasksList(tasksList => [...tasksList, selectedTask])
        }
        setActiveId(null);
        console.log('func end');
    }

    useEffect(() => {
        console.log('useEffect detect parent change to', JSON.stringify(parent, null, 2));
    }, [parent]);

    useEffect(() => {
        console.log('selectedTasks', JSON.stringify(selectedTasks, null, 2));
    }, [selectedTasks]);

    useEffect(() => {
        console.log('tasksList', JSON.stringify(tasksList, null, 2));
    }, [tasksList]);

    const addSprint = useCallback(async () => {
        try {
            const userDoc = await getDoc(doc(db, "users", userInfo?.uid))
            const sprintid = crypto.randomUUID()
            await setDoc(doc(db, "users", userInfo?.uid, "sprints", sprintid), ({
                id: sprintid,
                number: userDoc ? userDoc?.data()?.lastSprint : 0,
                commandId: currentCommandId,
                creationDate: Timestamp.now(),
                sprintState: "during"
            }) as DocumentData)
            await updateDoc(doc(db, "users", userInfo?.uid), {
                lastSprint: increment(1)
            })
            for (const task of selectedTasks) {
                await updateDoc(doc(db, "users", userInfo?.uid, "tasks", task.id), ({
                    sprint: sprintid
                }) as DocumentData)
            }
        } catch (errors) {
            console.log('errors', JSON.stringify(errors, null, 2));
        }
    }, [currentCommandId, selectedTasks, userInfo?.uid])

    const updateSprintsLimit = useCallback(() => {
        setSprintsLimit(sprintsLimit + 5);
    }, [sprintsLimit])

    const onTaskCloseClick = useCallback((task: DocumentData) => {
        try {
            const timeNow = dayjs(Timestamp.now().toDate()).format("DD-MM-YYYY")
            updateDoc(doc(db, "users", userInfo?.uid, "tasks", task.id), {
                completed: true,
                completedDate: timeNow
            } as DocumentData).then(() => {
                console.log("задача <<" + task.name + ">> закрыта");
            })
        } catch (errors) {
            console.log('errors', JSON.stringify(errors, null, 2));
        }
    }, [userInfo?.uid])

    const createSurvey = useCallback(async () => {
        console.log('кнопка тыкнута');
        if (surveyState === "created") {
            setModalVisible(true)
        }
        if (surveyState != "created") {
            setModalVisible(true)
            await setDoc(doc(db, "users", userInfo?.uid, "survey", "survey"), {
                selectedTasks: selectedTasks.map((task)=>({id: task.id, name: task.name, description: task.description})),
                users: [],
                userScore: [],
                completed: false
            } as DocumentData)
            setSurveyState("created")
        }
    }, [selectedTasks, surveyState, userInfo?.uid])

    const endSurvey = useCallback(async () => {
        setSurveyState("ended")
        await updateDoc(doc(db, "users", userInfo?.uid, "survey", "survey"), {
            completed: true
        } as DocumentData)
        //let surveyResult1: number[] = []
        //surveyResults.forEach((tasksRatedArray) => {
        //    for (let i = 0; i < surveyTasks.length; i++){
        //        {!surveyResult1[i]? surveyResult1[i] = 0: surveyResult1[i]}
        //        surveyResult1[i] += tasksRatedArray.mappedTasks[i].score
        //    }
        //})
        //console.log(surveyResult1)
        //console.log('surveyResults', JSON.stringify(surveyResults, null, 2));
        //for (const task of surveyResults) {
        //    console.log('task', JSON.stringify(task, null, 2));
        //    const sumScores = task.mappedTasks.reduce((accItem, part)=>{
        //        console.log('part', JSON.stringify(part, null, 2));
        //        console.log('accItem', JSON.stringify(accItem, null, 2));
        //        return accItem + part.score;
        //    }, 0);
        //    console.log('sumScores', JSON.stringify(sumScores, null, 2));
        //    //(sumScores, task.mappedTasks.length)
        //}
        const localSurveyResults = surveyResults.reduce((acc,el) => {
            for(const item of el.mappedTasks) {
                acc[item.id] =  acc[item.id] ?  acc[item.id] + item.score : item.score
            }
            return acc
        }, {})
        console.log('localSurveyResults', JSON.stringify(localSurveyResults, null, 2));
        surveyTasks.forEach(task => {
            updateDoc(doc(db, "users", userInfo?.uid, "tasks", task.id),{
                score: localSurveyResults[task.id]/surveyUsers.length
            } as DocumentData)
        })
    }, [surveyResults, surveyTasks, surveyUsers.length, userInfo?.uid])


    return (
        <div>
            {modalVisible ? <Modal modalHeader={"Опрос создан!"}
                                   modalText={`Опрос успешно создан и доступен по ссылке: https://scrum-manager-e0978.web.app/surveys/${userInfo?.uid}`}
                                   modalButtonText="Ок" closeModalFunc={setModalVisible}/> : null}
            {modalResultVisible ? <Modal modalHeader={"Результаты опроса"}
                                   modalText={`Всего участников опроса: ${surveyUsers.length}`}
                                   modalButtonText="Ок" closeModalFunc={setModalResultVisible}/> : null}
            <div>
                <h1> Спринты
                    <a>
                        список команд
                        <div>
                            {commands.map(renderCommand)}
                        </div>
                    </a>
                </h1>
                {currentCommandId != "" ? (
                    <span>
                        <div>
                            <button onClick={() => {
                                setAddSprintState(true)
                            }}> + </button>
                            {sprints?.map(renderSprint)}
                            <button onClick={updateSprintsLimit}> {" > "} </button>
                        </div>
                        {addSprintState ? (
                            <span>
                                <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
                                    <div className="TaskListContainer">
                                        <h2> все задачи </h2>
                                        <DroppableList key="listAllTasks" id="listAllTasks">
                                            {tasksList.map(renderTask)}
                                        </DroppableList>
                                    </div>

                                    <div className="TaskListContainer">
                                        <h2> задачи для спринта </h2>
                                        <DroppableList key="listSelectedTasks" id="listSelectedTasks">
                                            {selectedTasks.map(renderTask)}
                                        </DroppableList>
                                    </div>

                                    <DragOverlay dropAnimation={{
                                        duration: 500,
                                        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                                    }}>
                                        {activeId && tasksList.map((task) => (task.id)).includes(activeId) ? (<button
                                                // @ts-ignore: Object is possibly 'null'.
                                                className="TaskButtonDrag"> {tasksList ? (tasksList.find((task) => (task.id === activeId)).name) : null}</button>
                                        ) : null}
                                        {activeId && selectedTasks.map((task) => (task.id)).includes(activeId) ? (
                                            <button
                                                // @ts-ignore: Object is possibly 'null'.
                                                className="TaskButtonDrag"> {selectedTasks ? (selectedTasks.find((task) => (task.id === activeId)).name) : null}</button>
                                        ) : null}
                                </DragOverlay>
                                </DndContext>
                                    <div className="Description">
                                        <p> *Опрос создается по выбранным задачам</p>
                                        <p> *Задачи выбираются перетаскиванием </p>
                                        <p> *Статистика по опросу собирается только после закрытия опроса </p>
                                    </div>
                                    <div className="ButtonContainer">
                                        <button
                                            onClick={createSurvey}> {surveyState != "created" ? "Создать опрос" : "показать ссылку"} </button>
                                        <button onClick={addSprint}> Создать спринт </button>
                                        <button onClick={() => setAddSprintState(false)}> Отмена </button>
                                        {surveyState === "created" ? (
                                            <>
                                                <button onClick={() => setModalResultVisible(true)}> Результаты </button>
                                                <button onClick={endSurvey}> Завершить опрос </button>
                                            </>
                                        ) : null}
                                    </div>
                            </span>
                        ) : null}
                        {!addSprintState && currentTask?.name != "" ? (
                            <>
                                <div className="TaskHeader">
                                    <h1>{`Задача «${currentTask?.name}»`}</h1>
                                    {currentTask?.completed == false ? (
                                        <button className="ButtonTaskEnd" onClick={() => onTaskCloseClick(currentTask)}>
                                            завершить задачу
                                        </button>) : null}
                                </div>
                                <span className="TaskAllDescription">
                                <div className="TaskDesc" key={"TaskDesc"}>
                                    Описание выбранной задачи
                                    <div>
                                        {currentTask?.description}
                                    </div>
                                </div>
                                <div className="TaskDesc" key={"TaskMarks"}>
                                    Оценки
                                    <div>
                                        {currentTask?.score}
                                    </div>
                                </div>
                            </span>
                            </>
                        ) : null}
                    </span>
                ) : null}
            </div>
        </div>
    )
}

export default memo(Sprints)

