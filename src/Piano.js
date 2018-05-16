import React from 'react';
import _ from 'lodash';
import classNames from 'classnames';
import { noteToMidiNumber, getMidiNumberAttributes } from './midiHelpers';

function ratioToPercentage(ratio) {
  return `${ratio * 100}%`;
}

// TODO: refactor
function getKeyboardShortcutsForMidiNumbers(numbers, noteConfig, keyboardConfig) {
  if (!keyboardConfig) {
    return {};
  }
  let keyIndex = 0;
  const keysToMidiNumbers = {};
  for (let numIndex = 0; numIndex < numbers.length; numIndex += 1) {
    const num = numbers[numIndex];
    const { basenote, isAccidental } = getMidiNumberAttributes(num);

    const key = keyboardConfig[keyIndex];
    if (isAccidental) {
      keysToMidiNumbers[key.flat] = num;
    } else {
      keysToMidiNumbers[key.natural] = num;
      keyIndex += 1;

      if (keyIndex >= keyboardConfig.length) {
        break;
      }
    }
  }
  return keysToMidiNumbers;
}

function Key(props) {
  return (
    <div
      className={props.className}
      style={{
        position: 'absolute',
        top: 0,
        left: props.left,
        width: props.width,
        height: props.height,
        display: 'flex',
      }}
      onMouseDown={props.onNoteDown}
      onMouseUp={props.onNoteUp}
      onMouseEnter={props.isMouseDown ? props.onNoteDown : null}
      onMouseLeave={props.isMouseDown ? props.onNoteUp : null}
      onTouchStart={props.onNoteDown}
      onTouchCancel={props.onNoteUp}
      onTouchEnd={props.onNoteUp}
    >
      <div style={{ alignSelf: 'flex-end', flex: 1 }}>{props.children}</div>
    </div>
  );
}

class Piano extends React.Component {
  state = {
    keysDown: {},
    isMouseDown: false,
  };

  static defaultProps = {
    keyWidthToHeightRatio: 0.15, // TODO: use props.height instead?
    whiteKeyGutterRatio: 0.02,
    whiteKeyConfig: {
      widthRatio: 1,
      heightRatio: 1,
      heightKeyDownRatio: 0.98,
    },
    blackKeyConfig: {
      widthRatio: 0.66,
      heightRatio: 0.66,
      heightKeyDownRatio: 0.65,
    },
    noteConfig: {
      c: { offsetFromC: 0 },
      db: { offsetFromC: 0.55 },
      d: { offsetFromC: 1 },
      eb: { offsetFromC: 1.8 },
      e: { offsetFromC: 2 },
      f: { offsetFromC: 3 },
      gb: { offsetFromC: 3.5 },
      g: { offsetFromC: 4 },
      ab: { offsetFromC: 4.7 },
      a: { offsetFromC: 5 },
      bb: { offsetFromC: 5.85 },
      b: { offsetFromC: 6 },
    },
    renderNoteLabel: () => {},
  };

  componentDidMount() {
    // TODO: removeEventListener calls
    window.addEventListener('mousedown', () => {
      this.setState({
        isMouseDown: true,
      });
    });
    window.addEventListener('mouseup', () => {
      this.setState({
        isMouseDown: false,
      });
    });

    if (this.props.keyboardConfig) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
    }
  }

  componentWillUnmount() {
    if (this.props.keyboardConfig) {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
  }

  // Range of midi numbers from startNote to endNote
  getMidiNumbers() {
    const startNum = noteToMidiNumber(this.props.startNote);
    return _.range(startNum, noteToMidiNumber(this.props.endNote) + 1);
  }

  getMidiNumberForKey = (key) => {
    const mapping = getKeyboardShortcutsForMidiNumbers(
      this.getMidiNumbers(),
      this.props.noteConfig,
      this.props.keyboardConfig,
    );
    return mapping[key];
  };

  getKeyForMidiNumber = (midiNumber) => {
    const mapping = getKeyboardShortcutsForMidiNumbers(
      this.getMidiNumbers(),
      this.props.noteConfig,
      this.props.keyboardConfig,
    );
    for (let key in mapping) {
      if (mapping[key] === midiNumber) {
        return key;
      }
    }
    return null;
  };

  handleKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const midiNumber = this.getMidiNumberForKey(event.key);
    if (midiNumber) {
      this.handleNoteDown(midiNumber);
    }
  };

  handleKeyUp = (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const midiNumber = this.getMidiNumberForKey(event.key);
    if (midiNumber) {
      this.handleNoteUp(midiNumber);
    }
  };

  handleNoteDown = (midiNumber) => {
    // Prevents duplicate note firings
    if (this.state.keysDown[midiNumber] || this.props.disabled) {
      return;
    }
    this.setState((prevState) => ({
      keysDown: Object.assign({}, prevState.keysDown, {
        [midiNumber]: true,
      }),
    }));
    const attrs = getMidiNumberAttributes(midiNumber);
    this.props.onNoteDown(attrs);
  };

  handleNoteUp = (midiNumber) => {
    if (!this.state.keysDown[midiNumber] || this.props.disabled) {
      return;
    }
    this.setState((prevState) => ({
      keysDown: Object.assign({}, prevState.keysDown, {
        [midiNumber]: false,
      }),
    }));
    const attrs = getMidiNumberAttributes(midiNumber);
    this.props.onNoteUp(attrs);
  };

  getWhiteKeyCount() {
    return this.getMidiNumbers().filter((number) => {
      const { isAccidental } = getMidiNumberAttributes(number);
      return !isAccidental;
    }).length;
  }

  // Width of the white key as a ratio from 0 to 1, including the small space between keys
  getWhiteKeyWidthIncludingGutter() {
    return 1 / this.getWhiteKeyCount();
  }

  // Width of the white key as a ratio from 0 to 1
  getWhiteKeyWidth() {
    return this.getWhiteKeyWidthIncludingGutter() * (1 - this.props.whiteKeyGutterRatio);
  }

  // Key position is represented by the number of white key widths from the left
  getKeyPosition(midiNumber) {
    const OCTAVE_WIDTH = 7;
    const { octave } = getMidiNumberAttributes(midiNumber);
    const { offsetFromC } = this.getNoteConfig(midiNumber);
    const startNum = noteToMidiNumber(this.props.startNote);
    const { basenote: startBasenote, octave: startOctave } = getMidiNumberAttributes(startNum);
    const startOffsetFromC = this.props.noteConfig[startBasenote].offsetFromC;
    const offsetFromStartNote = offsetFromC - startOffsetFromC;
    const octaveOffset = OCTAVE_WIDTH * (octave - startOctave);
    return offsetFromStartNote + octaveOffset;
  }

  getNoteConfig(midiNumber) {
    const { basenote } = getMidiNumberAttributes(midiNumber);
    return this.props.noteConfig[basenote];
  }

  getKeyConfig(midiNumber) {
    return getMidiNumberAttributes(midiNumber).isAccidental
      ? this.props.blackKeyConfig
      : this.props.whiteKeyConfig;
  }

  getWidth() {
    return this.props.width ? `${this.props.width}px` : '100%';
  }

  getHeight() {
    return this.props.width
      ? `${this.props.width * this.getWhiteKeyWidth() / this.props.keyWidthToHeightRatio}px`
      : '100%';
  }

  render() {
    return (
      <div style={{ position: 'relative', width: this.getWidth(), height: this.getHeight() }}>
        {this.getMidiNumbers().map((num) => {
          const { note, basenote, isAccidental } = getMidiNumberAttributes(num);
          const keyConfig = this.getKeyConfig(num);
          const noteConfig = this.getNoteConfig(num);
          const isKeyDown = this.state.keysDown[num];
          return (
            <Key
              className={classNames('ReactPiano__Key', {
                'ReactPiano__Key--black': isAccidental,
                'ReactPiano__Key--white': !isAccidental,
                'ReactPiano__Key--disabled': this.props.disabled,
                'ReactPiano__Key--down': isKeyDown,
              })}
              left={ratioToPercentage(
                this.getKeyPosition(num) * this.getWhiteKeyWidthIncludingGutter(),
              )}
              width={ratioToPercentage(keyConfig.widthRatio * this.getWhiteKeyWidth())}
              height={ratioToPercentage(
                isKeyDown ? keyConfig.heightKeyDownRatio : keyConfig.heightRatio,
              )}
              onNoteDown={this.handleNoteDown.bind(this, num)}
              onNoteUp={this.handleNoteUp.bind(this, num)}
              isMouseDown={this.state.isMouseDown}
              key={num}
            >
              {this.props.disabled
                ? null
                : this.props.renderNoteLabel({
                    note,
                    basenote,
                    isBlack: isAccidental,
                    keyboardShortcut: this.getKeyForMidiNumber(num),
                  })}
            </Key>
          );
        })}
      </div>
    );
  }
}

export default Piano;
