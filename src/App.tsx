import React, { useState, Dispatch, SetStateAction } from 'react';
import BN from 'bignumber.js';
import { Navbar, Button, Alignment, Card, Elevation, FormGroup, InputGroup, ControlGroup, ButtonGroup, Classes, Icon, HTMLSelect, IOptionProps, Tag, Switch, IconName } from '@blueprintjs/core';
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
    if (attendeesCount.value === new BN(0)) {
      return new BN(0);
    }

    if (x.unit === LineItemUnit.CostPerPerson) {
      return x.value;
    }

    if (x.unit === LineItemUnit.CostPerGroup) {
      return x.value.div(attendeesCount.value);
    }

    throw new Error('invalid form variable unit');
  },

  TIMES(scalar: FormVariable, per: FormVariable, per2?: FormVariable) {
    if (scalar.unit === LineItemUnit.Miles && per.unit === LineItemUnit.CostPerMile) {
      return scalar.value.times(per.value);
    }

    if (scalar.unit === LineItemUnit.Rooms
        && per.unit === LineItemUnit.CostPerRoomPerNight
        && per2?.unit === LineItemUnit.Nights) {
      return scalar.value.times(per.value).times(per2.value);
    }

    throw new Error('invalid form variable unit');
  },

  WAYS(scalar: FormVariable, ways: TransportationWay) {
    if (ways === TransportationWay.OneWay) {
      return { value: scalar.value.times(2), unit: scalar.unit };
    }
    
    if (ways === TransportationWay.RoundTrip) {
      return scalar;
    }

    throw new Error('invalid call to ways')
  }
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

enum TransportationWay {
  OneWay,
  RoundTrip
}

interface TransportationWaySpec {
  value: TransportationWay;
  icon: IconName;
  label: string
}

const TransportationWaySpecs: TransportationWaySpec[] = [
  {
    value: TransportationWay.OneWay,
    icon: 'arrow-right',
    label: 'one way',
  },
  {
    value: TransportationWay.RoundTrip,
    icon: 'circle-arrow-right',
    label: 'round trip',
  }
]

const DEFAULT_DATE_FORMATTER = momentFormatter("MM/DD/YYYY");

const App: React.FC = () => {
  const [attendeesCount, setAttendeesCount] = useState({ value: new BN(0), unit: LineItemUnit.Persons });
  const { TOTAL, TIMES, PER_PERSON, WAYS } = createFormOps(attendeesCount);
  
  const [registration, setRegistration] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  
  const [hotelFees, setHotelFees] = useState({ value: new BN(0), unit: LineItemUnit.CostPerGroup });
  const [hotelDateRange, setHotelDateRange] = useState([undefined, undefined] as DateRange);
  const [hotelRooms, setHotelRooms] = useState({ value: new BN(0), unit: LineItemUnit.Rooms });
  const [hotelCostPerRoom, setHotelCostPerRoom] = useState({ value: new BN(0), unit: LineItemUnit.CostPerRoomPerNight });

  const [transportationFixed, setTransportationFixed] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  const [transportationVariableDistance, setTransportationVariableDistance] = useState({ value: new BN(0), unit: LineItemUnit.Miles });
  const [transportationVariableCostPerDistance, setTransportationCostPerDistance] = useState({ value: new BN(0), unit: LineItemUnit.CostPerMile })
  const [transportationCostPerTicket, setTransportationCostPerTicket] = useState({ value: new BN(0), unit: LineItemUnit.CostPerPerson });
  const [transportationVariableWays, setTransportationVariableWays] = useState(TransportationWay.OneWay);
  const [transportationTicketWays, setTransportationTicketWays] = useState(TransportationWay.RoundTrip);
  const [transportationMode, setTransportationMode] = useState(TransportationMode.Rental);

  const hotelNightsValue =
    !hotelDateRange || (!hotelDateRange[0] && !hotelDateRange[1]) ? 0 :
    !!hotelDateRange[0] != !!hotelDateRange[1] ? 1 :
    Math.max(1, moment(hotelDateRange[1]).diff(moment(hotelDateRange[0]), 'day'))

  const hotelNights: FormVariable = { value: new BN(hotelNightsValue), unit: LineItemUnit.Nights };

  const transportationVariableFees =
    WAYS(
      { value: TIMES(transportationVariableDistance, transportationVariableCostPerDistance), unit: LineItemUnit.CostPerGroup },
      transportationVariableWays);
  
  const transportationVariableReimbursement =
    WAYS({ value: transportationVariableDistance.value.times(TRAVEL_REIMBUSRMENT_PER_MILE), unit: LineItemUnit.CostPerGroup },
      transportationVariableWays);

  const transprotationVariable =
    sum(TOTAL(transportationVariableFees)
      , TOTAL(transportationVariableReimbursement));

  const transportationTicket =
    WAYS(transportationCostPerTicket, transportationTicketWays);

  const totalTransportation =
    sum(TOTAL(transportationFixed)
      , TOTAL(transportationTicket)
      , transprotationVariable);

  const perPersonRequestedTransportation =
    PER_PERSON(transportationFixed)
      .plus(PER_PERSON(transportationTicket))

  const perPersonRequestedRegistration = PER_PERSON(registration);

  const hotelRoomsTotal =
    TIMES(hotelRooms, hotelCostPerRoom, hotelNights);

  const totalHotel =
    sum(TOTAL(hotelFees)
      , hotelRoomsTotal);

  const perPersonRequestedHotel =
    PER_PERSON({ value: totalHotel, unit: LineItemUnit.CostPerGroup });

  const perPersonRequestedTotal =
    sum(perPersonRequestedRegistration
      , perPersonRequestedTransportation
      , perPersonRequestedHotel);

  const perPersonOutOfPocket =
    outOfPocket(perPersonRequestedTotal)
      .decimalPlaces(0, BN.ROUND_HALF_EVEN);

  const grandTotalOutOfPocket =
    perPersonOutOfPocket.times(attendeesCount.value);

  const totalRegistration = TOTAL(registration);

  const grandTotalRequested =
    sum(totalRegistration
      , totalTransportation
      , totalHotel);

  const totalRequestedVariable = transportationVariableFees;

  const totalRequestedFixed =
      perPersonRequestedTotal.times(attendeesCount.value);

  const grandTotalApproved =
    grandTotalRequested
      .minus(grandTotalOutOfPocket);

  const state = {
    attendeesCount,
    registration,
    hotel: {
      dates: hotelDateRange,
      nights: hotelNights,
      rooms: hotelRooms,
      costPerRoom: hotelCostPerRoom,
      roomsTotal: hotelRoomsTotal,
      fees: hotelFees,
      totals: {
        requested: totalHotel,
        perPerson: perPersonRequestedHotel,
      }
    },
    transportation: {
      fixed: transportationFixed,
      variable: {
        distance: transportationVariableDistance,
        costPerDistance: transportationVariableCostPerDistance,
      },
      ticket: transportationCostPerTicket,
      mode: transportationMode,
    },
    totals: {
      split: {
        fixed: totalRequestedFixed,
        variable: totalRequestedVariable,
      },
      decision: {
        requested: grandTotalRequested,
        approved: grandTotalApproved,
      },
      perPerson: {
        requested: perPersonRequestedTotal,
        outOfPocket: perPersonOutOfPocket,
      }
    }
  }

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

            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
              <FormGroup
                label="Requested variable"
                style={{ padding: '0 10px', float: 'right', width: 148 }}
              >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{totalRequestedVariable.value.toFormat(2)}</span>
              </FormGroup>

              <FormGroup
                label="Requested fixed"
                style={{ padding: '0 10px', float: 'right', width: 148 }}
              >
                <Icon icon="dollar" />
                <span style={{ float: 'right' }}>{totalRequestedFixed.toFormat(2)}</span>
              </FormGroup>
            </div>

            {/* <pre>{JSON.stringify(state, null, 2)}</pre> */}
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
                return <div style={{display: 'flex', flexWrap: 'wrap' }}>
                  <LineItemInput
                    {...injectHooks(transportationCostPerTicket, setTransportationCostPerTicket)}
                    label="Ticket price per person"
                    name="transportation-ticket-fee" />

                  <FormGroup label="Ticket price is per">
                    <ButtonGroup>
                      {TransportationWaySpecs.map((x, i) =>
                        <Button
                          key={i}
                          icon={x.icon}
                          active={transportationTicketWays === x.value}
                          onClick={() => setTransportationTicketWays(x.value)}>
                          {x.label}
                        </Button>
                      )}
                    </ButtonGroup>
                  </FormGroup>
                </div>

              case 'fixed':
                return <LineItemInput
                  {...injectHooks(transportationFixed, setTransportationFixed)}
                  label="Flat fee"
                  name="transportation-flat-fee"
                  labelInfo="(required)" />

              case 'variable':
                return (
                  <>
                    <div style={{display: 'flex', flexWrap: 'wrap'}}>
                      <LineItemInput
                        {...injectHooks(transportationVariableDistance, setTransportationVariableDistance)}
                        label="Travel distance"
                        name="transportation-variable-distance"
                        labelInfo="(required)"
                        units={[LineItemUnit.Miles]} />

                      <FormGroup label="Travel distance covers">
                        <ButtonGroup>
                          {TransportationWaySpecs.map((x, i) =>
                            <Button
                              key={i}
                              icon={x.icon}
                              active={transportationVariableWays === x.value}
                              onClick={() => setTransportationVariableWays(x.value)}>
                              {x.label}
                            </Button>
                          )}
                        </ButtonGroup>
                      </FormGroup>

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
                        <span style={{float: 'right'}}>{transportationVariableReimbursement.value.toFormat(2)}</span>
                      </FormGroup>
                    </div>

                    <LineItemInput
                      {...injectHooks(transportationVariableCostPerDistance, setTransportationCostPerDistance)}
                      label="Cost per mile"
                      name="transportation-cost-per-mile"
                      labelInfo="(required)"
                      units={[LineItemUnit.CostPerMile]} />
                  </>
                );
            }
          })}

          <h3>Lodging / Hotel</h3>

          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
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
              <span style={{ float: 'right' }}><span style={{ paddingRight: 5 }}>{hotelNights.value.toFixed(0)}</span><Tag minimal>nights</Tag></span>
            </FormGroup>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap'}}>
            <LineItemInput
              {...injectHooks(hotelRooms, setHotelRooms)}
              label="# of Rooms"
              name="hotel-rooms"
              labelInfo="(required)"
              units={[LineItemUnit.Rooms]} />

            <LineItemInput
              {...injectHooks(hotelCostPerRoom, setHotelCostPerRoom)}
              label="Cost per Room per Night"
              name="hotel-cost-per-room"
              labelInfo="(required)"
              units={[LineItemUnit.CostPerRoomPerNight]} />

            <LineItemInput
              {...injectHooks(hotelFees, setHotelFees)}
              label="Other hotel fees (include taxes, other fees)"
              name="hotel-fees"
              labelInfo="(optional)"
              units={[LineItemUnit.CostPerGroup]} />

            <FormGroup
              label="Total for hotel"
              style={{ padding: '0 10px' }}
            >
              <Icon icon="dollar" />
              <span style={{ float: 'right' }}><span style={{ paddingRight: 5 }}>{totalHotel.toFormat(0, BN.ROUND_HALF_UP)}</span></span>
            </FormGroup>
          </div>

        </Card>
      </main>
    </>
  );
}

export default App;
