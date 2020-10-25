import React, { useState } from 'react';
import { connect } from 'react-redux';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Keyboard,
    Animated,
    findNodeHandle,
    PanResponder,
    Easing
} from 'react-native';
import { BlurView } from "@react-native-community/blur";

import { togglePopUp, addStateListener, removeStateListener } from './tools'



const POPUP_SAFE_HEIGHT = 500;
const POPUP_ANIMATION_TIME = 300;
const ANIMATION_THRESHOLD = 100;
const CLICK_THRESHOLD = 30;
const HEIGHT_THRESHOLD = 10;


//swipeResponder - возвращает функцию которая возвращает объект который нужно накинуть на вью для того, что она свайпала попап (функция принимает true или false для включения экспериментальной функции клика по panResponder)
//swipeableBackgroundWithClick - если задний фон по мимо свайпа должен еще кликаться - EXPERIMENTAL
//backgroundSwipeable - разрешает свайп по заднем фону
//swipeable - разрешает свайп по попапу
//blurBackgroundStyle - стиль blur на заднем фоне
//blurBackgroundProps - пропсы blur на заднем фоне
//viewBackgroundStyle - стиль view на заднем фоне
//disableBackground - отключает задний фон
//backgroundType - view или blur - задний фон
//theme - popup или window - предписанные стили для попапа выезжающее снизу либо же окошка с отступами

// ЭКСПЕРИМЕНТАЛЬНОЕ значит что надо на реальном пальце подобрать CLICK_THRESHOLD таким, чтобы удобно кликалось. Эта константа говорить что при минимальном движении считать действие кликом или же свайпом

class PopUp extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            viewRef: null,
            showBackground: false
        }
    }

    popupHeight = POPUP_SAFE_HEIGHT;
    animation = new Animated.Value(-POPUP_SAFE_HEIGHT)
    animationValue = -POPUP_SAFE_HEIGHT;
    lastPopupHeight = undefined;
    animationLock = false;
    swipeActive = false;
    popupState = {
        isActive: false,
        activePopupName: false,
        props: {}
    }

    componentDidMount() {
        this.animation.addListener(({ value }) => {
            this.animationValue = value
        });

        addStateListener(this.props.name, this.stateChange)
    }

    componentWillUnmount() {
        removeStateListener(this.props.name, this.stateChange)
    }

    stateChange = (activePopUp, state, props) => {
        if (activePopUp == this.props.name) {
            const newIsShow = state;
            const prevIsShow = this.popupState.isActive;
            if (newIsShow != prevIsShow && !this.swipeActive) {
                this.popupState = {
                    isActive: newIsShow,
                    activePopupName: activePopUp,
                    props
                }
                this.animationLock = true;
                this.animate(newIsShow, () => {
                    this.animationLock = false;
                })
            }
        }
    }



    hidePopUpEvent = () => {
        this.onClose();
    }

    toggleBackground = (value) => {
        if (this.state.showBackground != value) {
            this.setState({ showBackground: value })
        }
    }

    checkThreshold = () => {
        //плюс потому что this.popupHeight положительный а анимация отрицательная
        return Math.abs(this.animationValue + 0) <= ANIMATION_THRESHOLD || Math.abs(this.animationValue + this.popupHeight) <= ANIMATION_THRESHOLD;
    }

    animate = (value, callback = () => { }, duration = POPUP_ANIMATION_TIME, easing) => {
        const isFinalState = typeof value === "boolean"
        let _value = value;
        if (isFinalState) {
            _value = value ? 0 : -this.popupHeight;
            if (value) {
                this.toggleBackground(true)
            }
        }


        Animated.timing(this.animation, {
            toValue: _value,
            duration: duration,
            easing,
            useNativeDriver: false
        }).start(() => {
            if (isFinalState) {
                if (this.checkThreshold()) {
                    this.forceFixAnimation();
                }
                if (!value) {
                    this.toggleBackground(false)
                    if (this.checkThreshold()) {
                        togglePopUp(this.props.name, false)
                        Keyboard.dismiss()
                    }
                }
            }
            callback();
        });
    }


    onLayout = (event) => {
        if (Math.abs(event.nativeEvent.layout.height - this.popupHeight) > HEIGHT_THRESHOLD) {
            this.popupHeight = event.nativeEvent.layout.height;
            const isOpen = this.popupState.isActive;
            if (!isOpen && !this.animationLock && this.popupHeight >= POPUP_SAFE_HEIGHT && !this.popupState.activePopupName) {
                this.animate(false, () => { }, 1);
            }
        }
    }

    setViewRef = (ref) => {
        this.setState({ viewRef: findNodeHandle(ref) })
    }

    onClose = () => {
        if (this.props.onClose) {
            this.props.onClose()
        } else {
            togglePopUp(this.props.name, false)
        }
    }

    createPanResponder = (allowClick = false) => {

        const _checkResponderThreshold = (evt, gestureState) => {
            if (allowClick) {
                return Math.abs(gestureState.dx) > CLICK_THRESHOLD || Math.abs(gestureState.dy) > CLICK_THRESHOLD
            } else {
                return true;
            }
        }

        return PanResponder.create({
            onMoveShouldSetResponderCapture: _checkResponderThreshold,
            onMoveShouldSetPanResponderCapture: _checkResponderThreshold,
            onPanResponderMove: (evt, gestureState) => {
                this.swipeActive = true;

                if (this.props.name !== this.popupState.activePopupName) {
                    togglePopUp(this.props.name, true)
                }

                if (!this.lastPopupHeight) {
                    this.lastPopupHeight = this.animationValue;
                }

                this.toggleBackground(true)

                let newHeight = this.lastPopupHeight - gestureState.dy;
                newHeight = newHeight < -this.popupHeight ? -this.popupHeight : newHeight;
                newHeight = newHeight > 0 ? 0 : newHeight;
                this.animate(newHeight, () => { }, 10)
            },
            onPanResponderRelease: (e, { vy, dy }) => {
                this.swipeActive = false;
                const newHeight = (this.lastPopupHeight || this.animationValue) - dy;
                const newPopupHeight = dy >= 0 ? -this.popupHeight : 0;
                const newState = dy >= 0 ? false : true;

                this.animate(newState, () => {
                    if (!newState) {
                        this.onClose()
                    }
                },
                    Math.abs((newPopupHeight - newHeight) * 2),
                    Easing.out(Easing.cubic));

                this.lastPopupHeight = undefined;
            }
        });
    }

    _panResponderWithoutClick;
    _panResponderWithClick;

    getPanResponder = (allowClick = false) => {
        if (!this._panResponderWithoutClick) {
            this._panResponderWithoutClick = this.createPanResponder(false);
        }

        if (!this._panResponderWithClick) {
            this._panResponderWithClick = this.createPanResponder(true);
        }

        return (allowClick ? this._panResponderWithClick : this._panResponderWithoutClick).panHandlers
    }

    forceFixAnimation = () => {
        Animated.timing(this.animation, {
            toValue: this.animationValue,
            duration: 1,
            useNativeDriver: false
        }).start();
    }

    getPopupStyles = (theme) => {
        let resultStyles = {
            container: {},
            content: {}
        };

        switch (theme) {
            case 'window': {
                resultStyles.container = styles.windowStyleContainer;
                resultStyles.content = styles.windowStyleContent;
                break;
            }

            case 'popup': {
                resultStyles.container = styles.popupStyleContainer;
                resultStyles.content = styles.popupStyleContent;
                break;
            }

            default: {
                break;
            }
        }

        return resultStyles;
    }

    render() {
        if (this.props.swipeResponder) {
            this.props.swipeResponder(this.getPanResponder)
        }

        let animatedOpacity = this.animation.interpolate({
            inputRange: [-this.popupHeight, 0],
            outputRange: [0, 1]
        })

        const useViewAsBackground = this.props.backgroundType == 'view';

        const popupStyles = this.getPopupStyles(this.props.theme)


        return (
            <View style={styles.flexContainer}>
                <View ref={this.setViewRef} style={[styles.flexContainer]}>
                    {
                        this.props.children
                    }
                </View>
                {
                    !this.props.disableBackground && this.state.showBackground && !useViewAsBackground && (
                        <Animated.View style={[styles.container, { opacity: animatedOpacity }]} >
                            <BlurView
                                blurAmount={10}
                                downsampleFactor={5}
                                viewRef={this.state.viewRef}
                                blurType="light"
                                {...this.props.blurBackgroundProps}
                                style={[styles.blurContainer, this.props.blurBackgroundStyle]}
                            />
                        </Animated.View>
                    )
                }
                {
                    !this.props.disableBackground && this.state.showBackground && (
                        <Animated.View style={[styles.container, { backgroundColor: useViewAsBackground ? 'rgba(0,0,0,0.5)' : 'rgba(0, 0, 0, 0.24)', opacity: animatedOpacity }, this.props.viewBackgroundStyle]} >
                        </Animated.View>
                    )
                }
                {
                    !this.props.disableBackground && this.state.showBackground && (
                        <View {...(this.props.backgroundSwipeable ? this.getPanResponder(this.props.swipeableBackgroundWithClick) : {})} style={[styles.container, { zIndex: 0, }]}>
                            <TouchableOpacity testID="closePopUp" activeOpacity={1} onPress={this.onClose} style={{ flex: 1 }} />
                        </View>

                    )
                }
                {
                    this.props.hint && (
                        <Animated.View style={{ ...styles.popupHintContainer, bottom: Animated.add(this.animation, new Animated.Value(this.popupHeight + 6)), }}>
                            <View style={styles.popupHint} />
                        </Animated.View>
                    )
                }
                <Animated.View style={[styles.popupContainer, { bottom: this.animation }]}>
                    <View onLayout={this.onLayout} {...(this.props.swipeable ? this.getPanResponder(false) : {})} style={[styles.commonStyleContainer, popupStyles.container, this.props.containerStyle]}>
                        <View style={[styles.commonStyleContent, popupStyles.content, this.props.contentStyle]}>
                            {
                                this.props.popUpContent ?
                                    React.cloneElement(this.props.popUpContent, this.popupState.props)
                                    : null
                                //<View style={{ borderColor: 'black', borderWidth: 2, height: 400 }} />
                            }
                        </View>
                    </View>
                </Animated.View>
            </View>
        )
    }
}



export default PopUp

const styles = StyleSheet.create({
    flexContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
    },
    blurContainer: {
        zIndex: 0,
        flex: 1
    },
    screenContainer: {
        flex: 1,
        zIndex: 3,
        justifyContent: 'flex-end',
        backgroundColor: "rgba(0, 0, 0, 0.24)"
    },
    safeContainer: {
        marginBottom: 16,
        marginHorizontal: 16,
        borderRadius: 16,
        backgroundColor: 'white',
        paddingBottom: 0
    },
    mainContainer: {
        //paddingVertical: 16
    },
    darkContainer: {
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    popupContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    commonStyleContainer: {
        overflow: 'hidden',
    },
    commonStyleContent: {
        overflow: 'hidden'
    },
    windowStyleContainer: {

    },
    windowStyleContent: {
        margin: 8,
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 16
    },
    popupStyleContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingVertical: 16,
    },
    popupStyleContent: {
    },
    popupHint: {
        backgroundColor: 'white',
        width: 60,
        borderRadius: 3,
        height: 4,
    },
    popupHintContainer: {
        position: 'absolute',
        height: 4,
        alignSelf: 'center',
    },

})