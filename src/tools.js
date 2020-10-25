import React from 'react'

let popups = []
let listeners = []

const togglePopUp = (name, props) => {
    listeners.forEach(listener => {
        listener(name, props)
    })
}

const addStateListener = (func) => {
    listeners.push(func)
}

const removeStateListener = (func) => {
    listeners = listeners.filter(listener => listeners != func);
}


export { togglePopUp, removeStateListener, addStateListener }