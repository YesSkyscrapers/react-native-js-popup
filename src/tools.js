import React from 'react'

let listeners = {}

const togglePopUp = (name, state, props) => {
    listeners[name] = listeners[name] ? listeners[name] : []
    listeners[name].forEach(listener => {
        listener(name, state, props)
    })
}

const addStateListener = (name, func) => {
    listeners[name] = listeners[name] ? listeners[name] : []
    listeners[name].push(func)
}

const removeStateListener = (name, func) => {
    listeners[name] = listeners[name].filter(listener => listener != func);
}


export { togglePopUp, removeStateListener, addStateListener }