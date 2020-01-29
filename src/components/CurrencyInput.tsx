// https://github.com/larkintuckerllc/react-currency-input

import React, { CSSProperties, FC, KeyboardEvent, useCallback } from 'react';
import BN from 'bignumber.js';

interface Props {
  className?: string;
  name?: string;
  max?: number;
  onValueChange: (value: BN) => void;
  style?: CSSProperties;
  value: BN;
  decimalPlaces?: number
}

const VALID_FIRST = /^[1-9]{1}$/;
const VALID_NEXT = /^[0-9]{1}$/;
const DELETE_KEY_CODE = 8;

export const CurrencyInput: FC<Props> = (props) => {
  const {
    className = '',
    max = Number.MAX_SAFE_INTEGER,
    onValueChange,
    value,
    name
  } = props;

  const style = props.style || {};
  if (!style.textAlign) {
    style.textAlign = 'right';
  }

  const decimalPlaces = props.decimalPlaces || 0;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      const { key, keyCode } = e;
      if (
        (value.isZero() && !VALID_FIRST.test(key)) ||
        (!value.isZero() && !VALID_NEXT.test(key) && keyCode !== DELETE_KEY_CODE)
      ) {
        return;
      }
      const decimalShift = new BN(10).pow(decimalPlaces);
      const valueString = value.times(decimalShift).toFixed(0);
      let nextValue: BN;
      if (keyCode !== DELETE_KEY_CODE) {
        const nextValueString: string = value.isZero() ? key : `${valueString}${key}`;
        nextValue = new BN(nextValueString);
      } else {
        const nextValueString = valueString.slice(0, -1);
        nextValue = nextValueString === '' ? new BN(0) : new BN(nextValueString);
      }
      nextValue = nextValue.div(decimalShift);
      onValueChange(nextValue);
    },
    [max, onValueChange, value]
  );
  const handleChange = useCallback(() => {
    // DUMMY TO AVOID REACT WARNING
  }, []);

  const valueDisplay = value.toFormat(decimalPlaces, BN.ROUND_HALF_EVEN, {  groupSize: 3, groupSeparator: ',', decimalSeparator: '.' });

  return (
    <input
      className={className}
      name={name}
      inputMode="numeric"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      style={style}
      value={valueDisplay}
    />
  );
};
