import axios from 'axios'
import * as api from '../API'
import * as TYPE from '../storeApi'
import { hmac256,timestamp, sqliteDBStrongDecode } from '../../../../static/js/public.js'
import uuid from 'uuid-random'


// var sqliteDB = new SqliteDB();
function initialState() {
  return {
    NOTES: {
        NOTE_LIST: [],
        UPDATE_TIME: 0
    }
  }
}
const state = {
  initialState: initialState(),
  NOTES: {
      NOTE_LIST: initialState().NOTES.NOTE_LIST,
      UPDATE_TIME: initialState().NOTES.UPDATE_TIME
  }
}
const getters = {
    GET_NOTES: (store) => {
        return store.NOTES
    }
}

const mutations = {
    [TYPE.NOTE_LIST]: (store, data) => {
        store.NOTES.NOTE_LIST = data
    },
    UPDATE_TIME: (store, data) => {
        store.NOTES.UPDATE_TIME = data.update_time
    },
    [TYPE.DELETE_NOTE]: (store, data) => {
        for(let i = 0; i<store.NOTES.NOTE_LIST.length;i++){
          if(store.NOTES.NOTE_LIST[i]['client_uuid'] == data.client_uuid){
            store.NOTES.NOTE_LIST[i].is_deleted = 1;
          }
        }
    },
    [TYPE.ADD_NOTE]: (store, data) => {
        store.NOTES.NOTE_LIST.push(data)
       
    },
    [TYPE.UPDATE_NOTE_CONTENT]: (store, data) => {
        for(let i = 0; i<store.NOTES.NOTE_LIST.length;i++){
            if(store.NOTES.NOTE_LIST[i].client_uuid == data.client_uuid){
                store.NOTES.NOTE_LIST[i].content = data.content
            }
        }
    },
    [TYPE.UPDATE_NOTE_SELECTED]: (store, data) => {
        for(let i = 0; i<store.NOTES.NOTE_LIST.length;i++){
            if(store.NOTES.NOTE_LIST[i].client_uuid == data.client_uuid){
                store.NOTES.NOTE_LIST[i].is_selected = data.is_selected
            }
        }
    },
    [TYPE.UPDATE_NOTE_VERSION]: (store, data) => {
        for(let i = 0; i<store.NOTES.NOTE_LIST.length;i++){
            if(store.NOTES.NOTE_LIST[i].client_uuid == data.note_uuid){
                store.NOTES.NOTE_LIST[i].version = data.version
            }
        }
    },
    [TYPE.UPDATE_NOTE_ISUPLOAD]: (store, data) => {
        for(let i = 0; i<store.NOTES.NOTE_LIST.length;i++){
            if(store.NOTES.NOTE_LIST[i].client_uuid == data.note_uuid){
                store.NOTES.NOTE_LIST[i].is_upload = 1
            }
        }
    },
    [TYPE.RESET_NOTE_MODULE]: (state, data) => {
      state[data.key] = data.value
    }
}

const actions = {
    [TYPE.NOTE_LIST]: ({commit,rootState}, data) => {
        sqliteDB.queryData(`select * from notes where book_uuid = '${data.book_uuid}'`).then((res) => {
            commit('NOTE_LIST', res)
        })
    },
    [TYPE.ADD_NOTE]: ({ commit,dispatch,state }, data) => {
        let UUID = uuid()
        let noteObj = {
            client_uuid: UUID,
            uid: data.uid,
            book_uuid: data.book_uuid,
            title: data.title,
            content: data.content,
            type_color: data.type_color,
            is_selected: 0,
            is_deleted: 0,
            is_upload: 0,
            version: data.version
        }
        let noteArry = [
            UUID,
            data.uid,
            data.book_uuid,
            data.title,
            data.content,
            data.type_color,
            0,
            0,
            0,
            data.version
        ];
        sqliteDB.insertData("INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?)", [noteArry])
            .then((res) => {
                if( state.NOTES.NOTE_LIST.length == 0 || state.NOTES.NOTE_LIST[0].book_uuid == data.book_uuid ){       //??????????????????????????????state??????
                    commit(TYPE.ADD_NOTE, noteObj);
                }

                dispatch('POST_NOTE', {
                    book_uuid: data.book_uuid,
                    notes: [{
                        note_uuid: UUID,
                        title: data.title,
                        type_color: data.type_color,
                        content: data.content,
                        is_deleted: data.is_deleted,
                        version: data.version
                    }]
                })

            });
    },
    [TYPE.DELETE_NOTE]: ({ commit, dispatch }, data) => {
        sqliteDB.executeSql(`UPDATE notes SET is_deleted = 1, is_upload = 0 WHERE client_uuid = '${data.client_uuid}'`).then((res) => {
            commit(TYPE.DELETE_NOTE, data)

            dispatch('POST_NOTE', {
                book_uuid: data.book_uuid,
                notes: [{
                    note_uuid: data.client_uuid,
                    title: data.title,
                    type_color: data.type_color,
                    content: data.content,
                    is_deleted: data.is_deleted,
                    version: data.version
                }]
            })

        })
    },
    [TYPE.UPDATE_NOTE_CONTENT]: ({commit, dispatch}, data) => {
        sqliteDB.executeSql(`UPDATE notes SET content = '${sqliteDBStrongDecode(data.content, "'")}', is_upload = 0 WHERE client_uuid = '${data.client_uuid}'`).then((res) => {
            commit(TYPE.UPDATE_NOTE_CONTENT, data)

            dispatch('POST_NOTE', {
                book_uuid: data.book_uuid,
                notes: [{
                    note_uuid: data.client_uuid,
                    title: data.title,
                    type_color: data.type_color,
                    content: data.content,
                    is_deleted: data.is_deleted,
                    version: data.version
                }, ]
            })

        })
    },
    [TYPE.UPDATE_NOTE_SELECTED]: ({commit, state, rootState}, data) => {
        //???????????????????????????
        sqliteDB.executeSql(`UPDATE notes SET is_selected = ${data.is_selected} WHERE client_uuid = '${data.client_uuid}'`).then((res) => {
            commit(TYPE.UPDATE_NOTE_SELECTED, data)
        })
    },
    //??????????????????
    [TYPE.NOTE_SYNC]: ({commit,dispatch},data) => {
        sqliteDB.queryData(`SELECT * FROM notes WHERE is_upload = 0 AND book_uuid = 'book-a002'`).then((res) => {
            var uploadDate = [];
            for (let i = 0; i < res.length; i++) {
                uploadDate.push({
                    note_uuid: res[i].client_uuid,
                    title: res[i].title,
                    type_color: res[i].type_color,
                    content: res[i].content,
                    is_deleted: res[i].is_deleted,
                    version: res[i].version
                })
            }

            dispatch('POST_NOTE', {
                book_uuid: 'book-a002',
                notes: uploadDate
            })
    
        })
    },
    //????????????????????????????????????
    GET_CLOUD_NOTES: ({commit,dispatch,rootState},data) => {
        let time = timestamp()
        axios.get(
            api.noteList + `?token=${rootState.user.user_center.token}&timestamp=${time}`, 
            {
                params: {
                    book_uuid: data.book_uuid,
                    page: data.page,
                    // update_time: data.update_time
                    update_time: 1538468471
                }
            },
            {
                headers: {
                    'x-sign-id': hmac256(rootState.user.user_center.token,api.noteList,time)
                }
            }
        ).then((response) => {
            let msg = response.data;

            if (msg.status == 200) {
                
                var noteDatas = msg.result.notes;

                if(msg.result.total > 0){
                    alert('??????????????????????????????????????????')
                    //??????????????????????????????client_uuid
                    sqliteDB.queryData(`SELECT client_uuid FROM notes WHERE book_uuid = '${data.book_uuid}'`).then((res) => {
                        var localNotes = [];
                        for (let j = 0; j < res.length; j++){
                            localNotes.push(res[j].client_uuid)
                        }

                        for (let i = 0; i < noteDatas.length; i++) {

                                //????????????????????????????????????????????????insert?????????update
                                if (localNotes.indexOf(noteDatas[i].note_uuid) > -1) {      //??????
                                    console.log('??????')
                                    sqliteDB.executeSql(`UPDATE notes SET content = '${sqliteDBStrongDecode(noteDatas[i].content,"'")}', is_upload = 1, is_deleted = ${noteDatas[i].is_deleted}, version = ${noteDatas[i].version}  WHERE client_uuid = '${noteDatas[i].note_uuid}'`).then((res) => {
                                        console.log('????????????')
                                    })
                                } else {        //??????
                                    let noteObj = {
                                        client_uuid: noteDatas[i].note_uuid,
                                        uid: 101304569,
                                        book_uuid: noteDatas[i].book_uuid,
                                        title: noteDatas[i].title,
                                        content: noteDatas[i].content,
                                        type_color: noteDatas[i].type_color,
                                        is_selected: 0,
                                        is_deleted: 0,
                                        is_upload: 1,
                                        version: noteDatas[i].version
                                    }
                                    let noteArry = [
                                        noteDatas[i].note_uuid,
                                        101304569,
                                        noteDatas[i].book_uuid,
                                        noteDatas[i].title,
                                        noteDatas[i].content,
                                        noteDatas[i].type_color,
                                        0,
                                        0,
                                        1,
                                        noteDatas[i].version
                                    ];
                                    sqliteDB.insertData("INSERT INTO notes VALUES(?,?,?,?,?,?,?,?,?,?)", [noteArry]).then((res) => {
                                        commit(TYPE.ADD_NOTE, noteObj);
                                        console.log('????????????')
                                        // dispatch('POST_NOTE', {
                                        //     book_uuid: data.book_uuid,
                                        //     notes: [{
                                        //         note_uuid: UUID,
                                        //         title: data.title,
                                        //         type_color: data.type_color,
                                        //         content: data.content,
                                        //         is_deleted: data.is_deleted,
                                        //         version: data.version
                                        //     }]
                                        // })
    
                                    });
                                }
                                
    
                           
            
                        }

                    })
                    
                    
                }else{
                    alert('???????????????')

                }
                
    
            } else {
                alert('????????????')
            }
        })
    },
    //??????????????????
    POST_NOTE: ({commit,rootState},data) => {
        let time = timestamp();
        axios.post(
            api.noteSync + `?token=${rootState.user.user_center.token}&timestamp=${time}`,
            {
                book_uuid: data.book_uuid,
                notes: data.notes
            },
            {
                headers: {
                    'x-sign-id': hmac256(rootState.user.user_center.token, api.noteSync, time, {
                        book_uuid: data.book_uuid,
                        notes: data.notes
                    })
                }
            }
        ).then((response) => {
            let msg = response.data;
            if (msg.status == 200) {
                var noteDatas = msg.result.datas;
                for (let i = 0; i < noteDatas.length; i++) {
                    if (noteDatas[i].code == 200) {
                        //???????????????????????????????????????????????????
                        sqliteDB.executeSql(`UPDATE notes SET version = ${noteDatas[i].version}, is_upload = 1  WHERE client_uuid = '${noteDatas[i].note_uuid}'`).then((res) => {
                            //??????sore??????
                            commit(TYPE.UPDATE_NOTE_VERSION, noteDatas[i])
                            commit(TYPE.UPDATE_NOTE_ISUPLOAD, noteDatas[i])
                        })
                    }else if (noteDatas[i].code == 409) {          //?????????????????????????????????
                        alert('???????????????????????????????????????')
                        sqliteDB.executeSql(`UPDATE notes SET content = '${sqliteDBStrongDecode(noteDatas[i].current_data.content,"'")}', is_upload = 1, is_deleted = ${noteDatas[i].current_data.is_deleted}, version = ${noteDatas[i].current_data.version}  WHERE client_uuid = '${noteDatas[i].note_uuid}'`).then((res) => {
                            console.log('????????????')
                            commit(TYPE.UPDATE_NOTE_VERSION, noteDatas[i].current_data)
                            commit(TYPE.UPDATE_NOTE_ISUPLOAD, noteDatas[i].current_data)
                            commit(TYPE.UPDATE_NOTE_CONTENT, {content:noteDatas[i].current_data.content,client_uuid:noteDatas[i].note_uuid})
                        })
                    }
                }
                //??????????????????????????????
                sqliteDB.executeSql(`UPDATE module_record SET update_time = ${msg.result.update_time} WHERE category = 101`).then((res) => {
                    commit('UPDATE_TIME', {update_time: msg.result.update_time})
                })

                console.log('????????????')
            } else {
                console.log('????????????')
            }
        })
    }

}


export default {
    state,
    getters,
    mutations,
    actions
}