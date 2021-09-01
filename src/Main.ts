import { soundPlayer } from "./Audio";
import { getBackground } from "./Background";
import { createGame, Player } from "./Game";
import { context, keyboard, keyboardMap, random, scene, TAU, WORLD_SIZE } from "./Globals";
import { LocalStorage } from "./LocalStorage";

const resize = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')
    canvas.width = document.body.clientWidth;
    canvas.height = document.body.clientHeight;
    const vMin = Math.min(document.body.clientWidth, document.body.clientHeight) / 100;
    document.documentElement.style.fontSize = `${vMin}px`;

    scene.scale = Math.min(window.innerWidth / WORLD_SIZE, window.innerHeight / WORLD_SIZE);
};
window.addEventListener('resize', resize);

const isTouchDevice = () => {
    try {
        document.createEvent("TouchEvent");
        return true;
    } catch (e) {
        return false;
    }
};

const enableSubscriberOnly = () => {
    document.querySelectorAll('.subscriber-only').forEach(element => element.classList.remove('subscriber-only'));
};

const initializeMonetization = () => {
    try {
        const monetization = (document as any).monetization;

        if (!monetization) {
            return;
        }

        monetization.addEventListener('monetizationstart', () => {
            if (monetization.state === 'started') {
                enableSubscriberOnly();
            }
        });
    } catch (error) {
        console.error('Failed to initialize monetization', error);
    }
};
initializeMonetization();

const getNextButton = (direction: 1 | -1) => {
    if (!activeScreen) {
        return undefined;
    }

    const allButtons = Array.from(activeScreen.querySelectorAll<HTMLDivElement>('.button'))
        .filter(b => b.offsetWidth > 0);

    let i: number;
    for (i = 0; i < allButtons.length; i++) {
        if (allButtons[i].classList.contains('active')) {
            return allButtons[(allButtons.length + i + direction) % allButtons.length];
        }
    }

    return undefined;
};

const getActiveButton = () => activeScreen && activeScreen.querySelector<HTMLDivElement>('.active');

const setActiveButton = (button: HTMLDivElement) => {
    if (!activeScreen) {
        return;
    }

    const active = getActiveButton();
    if (active) {
        active.classList.remove('active');
    }
    button.classList.add('active');
    soundPlayer.playMouseOver();
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = keyboardMap.get(e.code);
    if (key === 'arrowDown' || key === 'arrowRight') {
        const nextButton = getNextButton(1);
        if (nextButton) {
            setActiveButton(nextButton);
        }
    } else if (key === 'arrowLeft' || key === 'arrowUp') {
        const nextButton = getNextButton(-1);
        if (nextButton) {
            setActiveButton(nextButton);
        }
    } else if (key === 'enter') {
        const activeButton = getActiveButton();
        if (activeButton) {
            activeButton.click();
        } else {
            togglePause();
        }
    }

    if (key) {
        keyboard[key] = true;
    }
});

document.addEventListener('keyup', (e: KeyboardEvent) => {
    const key = keyboardMap.get(e.code);
    if (key) {
        keyboard[key] = false;
    }
});

let menuActive = false;

export const activateMenu = () => {
    const background = getBackground();
    background.increment();
    const player = new Player();
    player.position.x = 250;
    player.position.y = 400;

    let backgroundY = background.getHeight() * random();
    let previousTime = null;
    const renderBackground = (time: number) => {
        background.draw(context, backgroundY);

        context.save();
        context.translate(window.innerWidth / 2, window.innerHeight / 2);
        context.scale(scene.scale, scene.scale);
        context.translate(-WORLD_SIZE / 2, -WORLD_SIZE / 2);

        player.render(context);
        context.restore();

        if (previousTime) {
            backgroundY += (time - previousTime) * 0.01;
        }
        previousTime = time;
        if (menuActive) {
            window.requestAnimationFrame(renderBackground);
        }
    };

    enableCursor();
    menuActive = true;
    const menu = document.querySelector<HTMLDivElement>('#menu');
    menu.style.display = null;
    activeScreen = menu;
    setActiveButton(document.querySelector('#start'));
    window.requestAnimationFrame(renderBackground);
};

const deactivateMenu = () => {
    disableCursor();
    menuActive = false;
    activeScreen = null;
    document.querySelector<HTMLDivElement>('#menu').style.display = 'none';
};

const updateAudioText = () => {
    document.querySelector('#audio').setAttribute('data-text', `AUDIO ${soundPlayer.enabled ? 'YES' : 'NO'}`);
}

const setAudioActive = (value: boolean) => {
    LocalStorage.update(storage => storage.audio = soundPlayer.enabled = value);
    updateAudioText();
}

export const waitNextFrame = () => new Promise(window.requestAnimationFrame);
const wait = (time: number) => new Promise(resolve => setTimeout(resolve, time));
const waitRelayout = () => document.body.getClientRects() && waitNextFrame();

const waitForConsistentAnimation = async () => {
    let maxTries = 30;
    let delta: number;
    let sequence: number = 0;
    do {
        delta = -(await waitNextFrame()) + (await waitNextFrame());
        if (delta > 1000 / 60) {
            sequence = 0;
        } else {
            sequence++;
        }
    } while (--maxTries > 0 && sequence < 5);
};

let nextFadeId = 0;
export const fadeInTransition = async (ms: number = 500) => {
    const fadeTransition = document.querySelector<HTMLDivElement>('#fade-transition');
    const fadeId = ++nextFadeId;
    await waitForConsistentAnimation();
    fadeTransition.style.transition = `opacity ${ms}ms`;
    await waitRelayout();
    fadeTransition.classList.remove('visible');
    await wait(ms);
    if (fadeId === nextFadeId) {
        fadeTransition.style.zIndex = '-1';
    }
};

export const fadeOutTransition = async (ms: number = 500) => {
    const fadeTransition = document.querySelector<HTMLDivElement>('#fade-transition');
    const fadeId = ++nextFadeId;
    fadeTransition.style.transition = `opacity ${ms}ms`;
    fadeTransition.classList.add('visible');
    fadeTransition.style.zIndex = '1';
    await wait(ms);
};

let cursor: HTMLCanvasElement;
const initializeCursor = () => {
    cursor = document.createElement('canvas');
    cursor.width = screen.width * 0.02;
    cursor.height = screen.width * 0.02;
    const context = cursor.getContext('2d');
    context.scale(cursor.width / 100, cursor.width / 100);
    context.fillStyle = '#303';
    context.strokeStyle = '#fff';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(100, 30);
    context.lineTo(45, 45);
    context.lineTo(30, 100);
    context.closePath();
    context.fill();
    context.stroke();
    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = `.cursor{cursor:url('${cursor.toDataURL()}'),auto}`;
    document.body.append(cursorStyle);
};

const stampCircle = (context: CanvasRenderingContext2D, stamp: HTMLCanvasElement, textRadius: number, x: number, y: number) => {
    textRadius = textRadius;
    const steps = Math.ceil(TAU * textRadius);
    const angleStep = TAU / steps;
    for (let i = 0; i < steps; i++) {
        const angle = i * angleStep;
        context.drawImage(stamp, x + textRadius * Math.cos(angle), y - textRadius * Math.sin(angle));
    }
};

let logo: HTMLCanvasElement;
const drawLogo = () => {
    logo = document.querySelector<HTMLCanvasElement>('#logo');
    const ratio = 0.4;
    logo.width = Math.min(screen.height * window.devicePixelRatio, screen.width * window.devicePixelRatio) * 0.8;
    logo.height = logo.width * ratio;
    const context = logo.getContext('2d');
    const scale = logo.width;

    const canvas2 = document.createElement('canvas');
    canvas2.width = logo.width;
    canvas2.height = logo.height;
    const context2 = canvas2.getContext('2d');
    context2.font = `100 ${0.27 * scale}px Arial`;
    context2.textBaseline = 'top';
    context2.textAlign = 'center';

    const canvas3 = document.createElement('canvas');
    canvas3.width = logo.width;
    canvas3.height = logo.height;
    const context3 = canvas3.getContext('2d');

    const stepSize = 0.008 * scale;
    const finalI = Math.ceil(5 * stepSize);
    for (let i = 0; i <= finalI; i += stepSize) {
        const progress = i / finalI;
        context2.clearRect(0, 0, canvas2.width, canvas2.height);
        context3.clearRect(0, 0, canvas3.width, canvas3.height);
        context2.fillStyle = `hsla(${220}, 100%, ${50 + (progress * progress * 50)}%, 1)`;
        context2.fillText('SPACE', 0.5 * scale, 0.01 * scale);
        stampCircle(context3, canvas2, 0.015 * scale + finalI - i, 0, (finalI - i) * 0.4);
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'destination-out';
        context.drawImage(canvas3, 0, 0);
        context.globalCompositeOperation = 'source-over';
        context.globalAlpha = progress;
        context.drawImage(canvas3, 0, 0);
    }

    context2.font = `bolder ${0.2 * scale}px Arial`;
    context2.clearRect(0, 0, canvas2.width, canvas2.height);
    context3.clearRect(0, 0, canvas3.width, canvas3.height);
    context.rotate(-0.08);
    context2.fillStyle = '#000';
    context2.fillText('JUMP', 0.6 * scale, 0.2 * scale);
    stampCircle(context, canvas2, 0.02 * scale, 0, 0.03 * scale);

    context2.fillStyle = '#fff';
    context2.clearRect(0, 0, canvas2.width, canvas2.height);
    context2.fillText('JUMP', 0.6 * scale, 0.2 * scale);
    stampCircle(context, canvas2, 0.01 * scale, 0, 0.03 * scale);
};

const enableCursor = () => {
    document.body.classList.add('cursor');
};

const disableCursor = () => {
    document.body.classList.remove('cursor');
};

let activeScreen: HTMLDivElement = null;
let activeGame: ReturnType<typeof createGame> = null;
document.addEventListener('DOMContentLoaded', () => {
    const body: any = document.body;

    resize();

    const goToMenu = () => {
        activateMenu();
        updateAudioText();
        drawLogo();
        fadeInTransition(500);
    };

    document.querySelector('#audio').addEventListener('click', () => {
        setAudioActive(!soundPlayer.enabled);
    });

    document.querySelector('#fullscreen').addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            body.requestFullscreen();
        }
    });

    const startGame = async (params = {}) => {
        deactivateMenu();
        await fadeOutTransition();
        soundPlayer.buildSamples();
        activeGame = createGame(params);
        activeGame.start();
        await fadeInTransition(5000);
    };

    document.querySelector('#start').addEventListener('click', () => startGame());
    document.querySelector('#rockets').addEventListener('click', () => startGame({ rockets: true }));

    const goToFullscreen = () => {
        if (!LocalStorage.get().fullscreen || !document.fullscreenEnabled) {
            if (!document.fullscreenEnabled) {
                document.querySelector('#fullscreen').remove();
            }
            document.querySelector('#fullscreen-question').remove();
            goToAudio();
            return;
        }

        activeScreen = document.querySelector('#fullscreen-question');
        setActiveButton(document.querySelector('#fullscreen--yes'));
        fadeInTransition();
    };

    const goToAudio = () => {
        if (!LocalStorage.get().audio) {
            document.querySelector('#audio-question').remove();
            goToMenu();
        } else {
            activeScreen = document.querySelector('#audio-question');
            setActiveButton(document.querySelector('#audio--yes'));
            fadeInTransition();
        }
    };

    document.querySelector('#fullscreen--yes').addEventListener('click', async () => {
        await closeFullScreen();
        try {
            if (body.webkitEnterFullScreen) {
                await body.webkitEnterFullScreen();
            } else {
                await body.requestFullscreen();
            }
        } catch (error) {
            console.error(error);
        }
    });

    const closeFullScreen = async () => {
        await fadeOutTransition();
        getBackground().increment();
        document.querySelector('#fullscreen-question').remove();
        goToAudio();
    }

    const closeAudio = async () => {
        await fadeOutTransition();
        getBackground().increment();
        document.querySelector('#audio-question').remove();
        goToMenu();
    }

    document.querySelector('#fullscreen--no').addEventListener('click', () => {
        LocalStorage.update(storage => storage.fullscreen = false);
        closeFullScreen();
    });

    document.querySelector('#audio--no').addEventListener('click', () => {
        setAudioActive(false);
        closeAudio();
    });

    document.querySelector('#audio--yes').addEventListener('click', () => {
        setAudioActive(true);
        closeAudio();
    });

    document.body.addEventListener('mouseover', (event: MouseEvent) => {
        const element = <HTMLDivElement>event.target;
        if (element.matches('.button')) {
            setActiveButton(element);
        }
    });

    document.body.addEventListener('click', (event: MouseEvent) => {
        const element = <Element>event.target;
        if (element.matches('.button')) {
            soundPlayer.playClick();
        }
    });

    document.querySelector<HTMLDivElement>('#pause--continue').addEventListener('click', () => {
        unpause();
    });

    document.querySelector<HTMLDivElement>('#pause--abort').addEventListener('click', async () => {
        await unpause();
        activeGame.end();
        activeGame = null;
    });

    initializeCursor();
    enableCursor();

    goToFullscreen();
});

const pause = () => {
    if (!activeGame || activeGame.state.paused || activeGame.state.ending) {
        return;
    }

    activeGame.pause();
    const pauseScreen = document.querySelector<HTMLDivElement>('#pause');
    activeScreen = pauseScreen;
    setActiveButton(document.querySelector<HTMLDivElement>('#pause--continue'));
    pauseScreen.classList.add('visible');
    pauseScreen.style.zIndex = '2';
    enableCursor();
};

const unpause = async () => {
    const pauseScreen = document.querySelector<HTMLDivElement>('#pause');
    if (!activeGame || !activeGame.state.paused || activeScreen !== pauseScreen) {
        return;
    }

    activeScreen = null;
    pauseScreen.classList.remove('visible');
    disableCursor();
    await wait(300);
    pauseScreen.style.zIndex = null;
    activeGame.resumeLoop();
};

const togglePause = () => {
    if (!activeGame) {
        return;
    }

    if (activeGame.state.paused) {
        unpause();
    } else {
        pause();
    }
};

if (isTouchDevice()) {
    document.body.classList.add('touch');

    const setActive = (callback: (event: TouchEvent) => void) => (event: TouchEvent) => {
        (event.target as HTMLDivElement).classList.add('is-active');
        callback(event);
    };

    const unsetActive = (callback: (event: TouchEvent) => void) => (event: TouchEvent) => {
        (event.target as HTMLDivElement).classList.remove('is-active');
        callback(event);
    };

    const filterTouch = (callback: (key: string) => void) => (event: TouchEvent) => {
        const key = (event.target as HTMLDivElement).getAttribute('data-touch-key');
        if (key in keyboard) {
            event.preventDefault();
            callback(key);
        }
    };

    const flagKey = (key: string) => {
        keyboard[key] = true;

        if (key === 'enter') {
            togglePause();
        }
    };
    const unflagKey = (key: string) => keyboard[key] = false;

    document.addEventListener('touchstart', setActive(filterTouch(flagKey)));
    document.addEventListener('touchend', unsetActive(filterTouch(unflagKey)));
}
