import React, { useState, Dispatch, SetStateAction } from 'react';
import BN from 'bignumber.js';
import { Navbar, Button, Alignment, Card, Elevation, FormGroup, InputGroup, ControlGroup, ButtonGroup, Classes, Icon, HTMLSelect, IOptionProps, Tag } from '@blueprintjs/core';
import { LineItemInput, LineItemUnit, LineItemInputProps } from './components/LineItemInput';

import { DateRange, DateRangeInput, IDateFormatProps, TimePrecision } from "@blueprintjs/datetime";

import './App.css';
import { MomentDateRange } from './components/MomentDates';
import moment from 'moment';

enum TransportationMode {
  None = 'none',
  Airplane = 'airplane',
  Train = 'train',
  Bus = 'bus',
  Rental = 'rental',
  Charter = 'charter',
  Custom = 'custom',
}

type TransportationFormula =
  'ticket' | 'variable' | 'fixed'

const TRANSPORTATION_OPTIONS: IOptionProps[] = [
  { value: TransportationMode.None, label: 'N/A' },
  { value: TransportationMode.Airplane, label: 'Airplane' },
  { value: TransportationMode.Train, label: 'Train' },
  { value: TransportationMode.Bus, label: 'Bus' },
  { value: TransportationMode.Rental, label: 'Rental vehicle' },
  { value: TransportationMode.Charter, label: 'Charter bus' },
  { value: TransportationMode.Custom, label: 'Other' },
]

const TRANSPORTATION_SPEC: Record<TransportationMode, TransportationFormula[]> = {
  [TransportationMode.Airplane]: ['ticket'],
  [TransportationMode.Train]: ['ticket'],
  [TransportationMode.Bus]: ['ticket'],
  [TransportationMode.Rental]: ['variable', 'fixed'],
  [TransportationMode.Charter]: ['fixed'],
  [TransportationMode.Custom]: ['fixed', 'variable', 'ticket'],
  [TransportationMode.None]: [],
}

const TRAVEL_REIMBUSRMENT_PER_MILE = new BN('0.435'); // per mile

type FormVariable = { value: BN, unit: LineItemUnit };

const createFormOps = (attendeesCount: FormVariable) => ({
  TOTAL(x: FormVariable) {
    if (x.unit === LineItemUnit.CostPerPerson) {
      return x.value.times(attendeesCount.value);
    }

    if (x.unit === LineItemUnit.CostPerGroup) {
      return x.value
    }

    throw new Error('invalid form variable unit');
  },

  PER_PERSON(x: FormVariable) {
    if (x.unit === LineItemUnit.CostPerPerson) {
      return x.value;
    }

    if (x.unit === LineItemUnit.CostPerGroup) {
      return x.value.div(attendeesCount.value);
    }

    throw new Error('invalid form variable unit');
  },

  TIMES(scalar: FormVariable, per: FormVariable) {
    if (scalar.unit === LineItemUnit.Miles && per.unit === LineItemUnit.PerMile) {
      return scalar.value.times(per.value);
    }

    throw new Error('invalid form variable unit');
  },
});

const outOfPocket = (x: BN) => {
  // Rule 7
  if (x.isLessThan(new BN('10.00'))) {
    return x;
  }

  if (x.isLessThan(new BN('25.00'))) {
    return new BN('5.00')
  }

  if (x.isLessThan(new BN('35.00'))) {
    return new BN('10.00');
  }

  // Rule 13 (Figure 1)
  if (x.isLessThan(new BN('100.00'))) {
    return x.times(new BN('0.25'));
  }

  if (x.isLessThan(new BN('700.00'))) {
    return x.times('0.125').plus('12.50');
  }

  return x.minus('600.00');
}

const injectHooks: ((value: FormVariable, set: Dispatch<SetStateAction<FormVariable>>) => Pick<LineItemInputProps, 'value' | 'setValue' | 'defaultUnit' | 'setUnit'>) =
  (obj, set) => ({
    value: obj.value,
    setValue: (x) => set({ ...obj, value: x }),
    defaultUnit: obj.unit,
    setUnit: (x) => set({ ...obj, unit: x }),
  });

const sum = (...values: BN[]) => values.reduce((total, x) => total.plus(x), new BN(0));

const momentFormatter: (format: string) => IDateFormatProps = (format) => {
  return {
    formatDate: date => moment(date).format(format),
    parseDate: str => moment(str, format).toDate(),
    placeholder: `${format}`,
  };
}

const DEFAULT_DATE_FORMATTER = momentFormatter("MM/DD/YYYY");

const App: React.FC = () => {
  const [attendeesCount, setAttendeesCount] = useState({ value: new BN(0), unit: LineItemUnit.Persons });
  const { TOTAL, TIMES, PER_PERSON } = createFormOps(attendeesCount);
  
  const [registration, setRegistration] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  
  const [hotel, setHotel] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  const [hotelDateRange, setHotelDateRange] = useState([undefined, undefined] as DateRange);

  const [transportationFixed, setTransportationFixed] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  const [transportationDistance, setTransportationDistance] = useState({ value: new BN(0), unit: LineItemUnit.Miles });
  const [transportationCostPerDistance, setTransportationCostPerDistance] = useState({ value: new BN(0), unit: LineItemUnit.PerMile })
  const [transportationTicket, setTransportationTicket] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  const [transportationMode, setTransportationMode] = useState(TransportationMode.Rental);

  const hotelNights =
    !hotelDateRange || (!hotelDateRange[0] && !hotelDateRange[1]) ? 0 :
    !!hotelDateRange[0] != !!hotelDateRange[1] ? 1 :
    Math.max(1, moment(hotelDateRange[1]).diff(moment(hotelDateRange[0]), 'day'))

  const transportationVariable =
    TIMES(transportationDistance, transportationCostPerDistance);

  const totalTransportation =
    sum(TOTAL(transportationFixed)
      , TOTAL(transportationTicket)
      , transportationVariable);

  const perPersonRequestedTransportation =
    PER_PERSON(transportationFixed)
      .plus(PER_PERSON(transportationTicket))

  const perPersonRequestedRegistration = PER_PERSON(registration);

  const perPersonRequestedHotel = PER_PERSON(hotel);

  const perPersonRequestedTotal =
    sum(perPersonRequestedRegistration
      , perPersonRequestedTransportation
      , perPersonRequestedHotel);

  const perPersonOutOfPocket =
    outOfPocket(perPersonRequestedTotal)
      .decimalPlaces(0, BN.ROUND_UP);

  const grandTotalOutOfPocket =
    perPersonOutOfPocket.times(attendeesCount.value);

  const totalRegistration = TOTAL(registration);

  const totalHotel = TOTAL(hotel);

  const grandTotalRequested =
    sum(totalRegistration
      , totalTransportation
      , totalHotel);

  const totalRequestedVariable = transportationVariable;

  const totalRequestedFixed =
      perPersonRequestedTotal.times(attendeesCount.value);

  const grandTotalApproved =
    grandTotalRequested
      .minus(grandTotalOutOfPocket);

  return (
    <>
      <Navbar className="sf-navbar">
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading>specflow</Navbar.Heading>
          <Navbar.Divider />
          <Button className="bp3-minimal" icon="home" text="Home" />
          <Button className="bp3-minimal" icon="document" text="Files" />
        </Navbar.Group>
      </Navbar>

      <main style={{margin: 10}}>
        <Card elevation={Elevation.TWO}>
          <h2 style={{display: 'inline-block'}}>Group 1</h2>
        
          <aside style={{ display: 'flex', flexDirection: 'column', float: 'right'}}>
            <div style={{display: 'flex', flexDirection: 'row'}}>
              <FormGroup
                label="Total requested expenses"
                style={{ padding: '0 10px', float: 'right', maxWidth: 148, fontWeight: 'bold' }}
              >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{grandTotalRequested.toFormat(2)}</span>
              </FormGroup>

              <FormGroup
                label="Total approved expenses"
                style={{ padding: '0 10px', float: 'right', width: 148, fontWeight: 'bold' }}
            >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{grandTotalApproved.toFormat(2)}</span>
              </FormGroup>
            </div>

            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <FormGroup
                label="Requested per person"
                style={{ padding: '0 10px', float: 'right', width: 148, fontWeight: 'bold' }}
              >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{perPersonRequestedTotal.toFormat(2)}</span>
              </FormGroup>

              <FormGroup
                label="Out of pocket per person"
                style={{ padding: '0 10px', float: 'right', width: 148, fontWeight: 'bold' }}
            >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{perPersonOutOfPocket.toFormat(2)}</span>
              </FormGroup>
            </div>

            <div style={{ display: 'flex', flexDirection: 'row' }}>
              <FormGroup
                label="Requested variable"
                style={{ padding: '0 10px', float: 'right', width: 148 }}
              >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{totalRequestedVariable.toFormat(2)}</span>
              </FormGroup>

              <FormGroup
                label="Requested fixed"
                style={{ padding: '0 10px', float: 'right', width: 148 }}
              >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{totalRequestedFixed.toFormat(2)}</span>
              </FormGroup>
            </div>
          </aside>

          <LineItemInput
            {...injectHooks(attendeesCount, setAttendeesCount)}
            label="Number of attendees"
            name="attendees-count"
            labelInfo="(required)"
            units={[LineItemUnit.Persons]} />

          <h3>Registration</h3>

          <LineItemInput
            {...injectHooks(registration, setRegistration)}
            label="Registration fees"
            name="registration-fees"
            labelInfo="(optional)" />

          <h3>Transportation</h3>

          <FormGroup
            label="Mode of transportation"
            labelFor="transportation-mode"
            labelInfo="(required)"
          >
            <HTMLSelect
              options={TRANSPORTATION_OPTIONS}
              onChange={(e) => setTransportationMode(e.currentTarget.value as TransportationMode)}
              value={transportationMode} />
          </FormGroup>

          {TRANSPORTATION_SPEC[transportationMode].map((x, i) => {
            switch (x) {
              case 'ticket':
                return <LineItemInput
                  {...injectHooks(transportationTicket, setTransportationTicket)}
                  label="Ticket price per person"
                  name="transportation-ticket-fee"
                  labelInfo="(required)" />

              case 'fixed':
                return <LineItemInput
                  {...injectHooks(transportationFixed, setTransportationFixed)}
                  label="Flat fee"
                  name="transportation-flat-fee"
                  labelInfo="(required)" />

              case 'variable':
                return (
                  <>
                    <div style={{display: 'flex'}}>
                      <LineItemInput
                        {...injectHooks(transportationDistance, setTransportationDistance)}
                        label="Travel distance"
                        name="transportation-variable-distance"
                        labelInfo="(required)"
                        units={[LineItemUnit.Miles]} />

                      <FormGroup
                        label="Travel reimbursement rate"
                        style={{ padding: '0 10px' }}
                      >
                        <Icon icon="dollar" />
                        <span style={{float: 'right'}}><span style={{ paddingRight: 5 }}>{TRAVEL_REIMBUSRMENT_PER_MILE.toFormat()}</span><Tag minimal>per mile</Tag></span>
                      </FormGroup>

                      <FormGroup
                        label="Travel reimbursement"
                        style={{padding: '0 10px'}}
                      >
                        <Icon icon="dollar" />
                        <span style={{float: 'right'}}>{transportationDistance.value.times(TRAVEL_REIMBUSRMENT_PER_MILE).toFormat(2)}</span>
                      </FormGroup>
                    </div>

                    <LineItemInput
                      {...injectHooks(transportationCostPerDistance, setTransportationCostPerDistance)}
                      label="Cost per mile"
                      name="transportation-cost-per-mile"
                      labelInfo="(required)"
                      units={[LineItemUnit.PerMile]} />
                  </>
                );
            }
          })}

          <h3>Lodging / Hotel</h3>

          <div style={{display: 'flex'}}>
            <FormGroup
              label="Hotel check-in &amp; check-out dates">
              <DateRangeInput
                {...DEFAULT_DATE_FORMATTER}
                allowSingleDayRange={true}
                contiguousCalendarMonths={true}
                onChange={setHotelDateRange}
                value={hotelDateRange}
                shortcuts={false}
              />
              <MomentDateRange range={hotelDateRange} />
            </FormGroup>

            <FormGroup
              label="Hotel nights"
              style={{ padding: '0 10px' }}
            >
              <Icon icon="moon" />
              <span style={{ float: 'right' }}><span style={{ paddingRight: 5 }}>{hotelNights}</span><Tag minimal>nights</Tag></span>
            </FormGroup>
          </div>

          <LineItemInput
            {...injectHooks(hotel, setHotel)}
            helperText="Helper text with details..."
            label="Hotel fees"
            name="hotel-fees"
            labelInfo="(optional)" />

        </Card>
      </main>
    </>
  );
}

export default App;
