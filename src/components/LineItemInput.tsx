import React, { useState, useEffect } from "react";
import BN from 'bignumber.js';
import { FormGroup, ControlGroup, Classes, Icon, ButtonGroup, Button, IconName, Tag } from "@blueprintjs/core";
import { CurrencyInput } from "./CurrencyInput";

export type LineItemInputProps = {
  value: BN,
  setValue: ((x: BN) => void),
  helperText?: React.ReactNode,
  label?: React.ReactNode,
  name?: string,
  labelInfo?: React.ReactNode,
  iconInput?: IconName,
  tag?: React.ReactNode,
  units?: LineItemUnit[],
  defaultUnit: LineItemUnit,
  setUnit: ((x: LineItemUnit) => void),
  overrideDecimalPlaces?: number,
}

export enum LineItemUnit {
  CostPerPerson = 'per person',
  CostPerGroup = 'per group',
  Miles = 'miles',
  CostPerMile = 'per mile',
  Persons = 'people',
  Rooms = 'rooms',
  CostPerRoomPerNight = 'USD/room/night',
  Nights = 'nights',
}

type LineItemUnitSpec = {
  value: LineItemUnit,
  iconUnit?: IconName,
  iconInput?: IconName,
  label: string,
  tag?: string
  decimalPlaces?: number,
  paddingRight?: number | string,
};

const LineItemUnitSpecs: Record<LineItemUnit, LineItemUnitSpec> = {
  [LineItemUnit.CostPerPerson]: {
    value: LineItemUnit.CostPerPerson,
    iconInput: 'dollar',
    iconUnit: 'person',
    label: 'per person',
  },
  [LineItemUnit.CostPerGroup]: {
    value: LineItemUnit.CostPerGroup,
    iconInput: 'dollar',
    iconUnit: 'people',
    label: 'per group'
  },
  [LineItemUnit.Miles]: {
    value: LineItemUnit.Miles,
    iconInput: 'map',
    label: 'miles',
    tag: 'miles',
    decimalPlaces: 1
  },
  [LineItemUnit.Rooms]: {
    value: LineItemUnit.Rooms,
    label: 'rooms',
    tag: 'rooms',
    decimalPlaces: 0
  },
  [LineItemUnit.CostPerRoomPerNight]: {
    value: LineItemUnit.CostPerRoomPerNight,
    iconInput: 'dollar',
    label: 'per room',
    tag: 'per room',
    paddingRight: '4.8em',
  },
  [LineItemUnit.CostPerMile]: {
    value: LineItemUnit.CostPerMile,
    iconInput: 'dollar',
    label: 'per mile',
    tag: 'per mile',
    decimalPlaces: 2,
    paddingRight: '4.6em',
  },
  [LineItemUnit.Persons]: {
    value: LineItemUnit.Persons,
    iconInput: 'people',
    label: '# of people',
    tag: 'people',
    paddingRight: '4em',
    decimalPlaces: 0
  },
  [LineItemUnit.Nights]: {
    value: LineItemUnit.Nights,
    iconInput: 'moon',
    label: 'nights',
    tag: 'nights',
    decimalPlaces: 0
  }
}

export const LineItemInput = (props: LineItemInputProps) => {
  const {
    value, setValue, defaultUnit, setUnit,
    helperText, label, name: labelName, labelInfo, overrideDecimalPlaces } = props;

  const units = props.units || [LineItemUnit.CostPerPerson, LineItemUnit.CostPerGroup];
  const allUnitSpecs = units.map(x => LineItemUnitSpecs[x]);
  const unitSpec = LineItemUnitSpecs[defaultUnit];
  const tag = props.tag || unitSpec.tag;
  const iconInput = props.iconInput || unitSpec.iconInput;

  return (
    <FormGroup
      helperText={helperText}
      label={label}
      labelFor={labelName}
      labelInfo={labelInfo}
    >
      <ControlGroup fill={false} vertical={false}>
        <div className={Classes.INPUT_GROUP}>
          <Icon icon={iconInput} />
          <CurrencyInput 
            name={labelName}
            className={Classes.INPUT}
            value={value}
            onValueChange={setValue}
            style={tag ? {
              textAlign: 'right',
              paddingRight: unitSpec.paddingRight || '3.5em',
              width: 196} : undefined}
            decimalPlaces={
              typeof overrideDecimalPlaces !== 'undefined' ? overrideDecimalPlaces :
              typeof unitSpec.decimalPlaces !== 'undefined' ? unitSpec.decimalPlaces :
              undefined} />
          {tag
            ? <span className={Classes.INPUT_ACTION}>
                <Tag style={{ float: 'right' }} minimal={true}>{tag}</Tag>
              </span>
            : <></>}
        </div>
        {allUnitSpecs.length > 1 ?
          <ButtonGroup>
            {allUnitSpecs.map((x, i) => 
             <Button
              key={i}
              icon={x.iconUnit}
              active={defaultUnit === x.value}
              onClick={() => setUnit(x.value)}>
                {x.label}
            </Button>
            )}
          </ButtonGroup>
          : <></>
        }
      </ControlGroup>
    </FormGroup>
  );
}