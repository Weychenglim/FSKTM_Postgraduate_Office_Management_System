/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// The rows of a letter's student form, laid out like UM Maya's "Letter Details
// Application Form": label on the left, field in the middle, hint on the right.
// The office's questions decide which rows appear. Used by the student's form
// and by the live preview in the letter type editor.

import React, { createContext, useContext, useState } from 'react';
import { SelectMenu } from './SelectMenu';
import type { LetterFormQuestion, LetterRecipientPurpose, LetterRequestDetails } from '../types';
import { COUNTRIES, MALAYSIA, MALAYSIAN_STATES, asksState } from '../utils/addressPlaces';

export const FORM_ROW = 'grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] lg:grid-cols-[11rem_minmax(0,30rem)_minmax(0,1fr)] sm:gap-x-6 sm:items-start';
// The office's preview sits in half a page, so its hints go under the field.
const COMPACT_ROW = 'grid gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-4 sm:items-start';
const Compact = createContext(false);
const LABEL = 'text-[13px] font-semibold text-slate-700 sm:text-right sm:pt-3';
const TYPE_IT = '__type_it__';

const ADDRESS_ROWS: ReadonlyArray<{ field: keyof LetterRequestDetails; label: string; hint: string; missing?: string; narrow?: boolean }> = [
  { field: 'addressLine1', label: 'Address Line 1', hint: 'Enter recipient address', missing: 'Enter the address.' },
  { field: 'addressLine2', label: 'Address Line 2', hint: 'Enter recipient address' },
  { field: 'postcode', label: 'Postcode', hint: 'Enter recipient postcode', missing: 'Enter the postcode.', narrow: true },
  { field: 'city', label: 'City', hint: 'Enter recipient city', missing: 'Enter the city.' },
];
const STATE_OPTIONS = MALAYSIAN_STATES.map((state) => ({ value: state, label: state }));
const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({ value: country, label: country }));

export const FormRow: React.FC<{
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, required, hint, error, children }) => {
  const compact = useContext(Compact);
  const text = (
    <>
      {label}
      {required && <span className="text-rose-600"> *</span>}
    </>
  );
  return (
    <div className={compact ? COMPACT_ROW : FORM_ROW}>
      {htmlFor ? <label htmlFor={htmlFor} className={LABEL}>{text}</label> : <span className={LABEL}>{text}</span>}
      <div className="min-w-0 space-y-1">
        {children}
        {error && <p role="alert" className="text-sm font-medium leading-relaxed text-rose-800">{error}</p>}
      </div>
      {hint && (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className={`card-description sm:col-start-2 ${compact ? '' : 'lg:col-start-auto lg:pt-3'}`}>
          {hint}
        </p>
      )}
    </div>
  );
};

export type LetterAnswers = Record<string, string | boolean>;

interface LetterFormFieldsProps {
  questions: LetterFormQuestion[];
  programme: string;
  applicationDate: string;
  details: LetterRequestDetails;
  onDetails: (details: LetterRequestDetails) => void;
  answers: LetterAnswers;
  onAnswer: (name: string, value: string | boolean) => void;
  /** By field: purpose, organisation, an address line, include, or `answer:NAME`. */
  errors?: Record<string, string>;
  disabled?: boolean;
  /** The office's preview: everything shown, nothing can be typed, laid out narrow. */
  preview?: boolean;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const LetterFormFields: React.FC<LetterFormFieldsProps> = ({
  questions,
  programme,
  applicationDate,
  details,
  onDetails,
  answers,
  onAnswer,
  errors = {},
  disabled = false,
  preview = false,
}) => {
  const [typing, setTyping] = useState(() => details.typedIn === true);
  const off = disabled || preview;
  const change = (changes: Partial<LetterRequestDetails>) => onDetails({ ...details, ...changes });

  const recipientRows = (question: Extract<LetterFormQuestion, { kind: 'recipient' }>) => {
    const purpose: LetterRecipientPurpose | null = question.options.find((option) => option.code === details.purpose) ?? null;
    const listed = purpose?.organisations ?? [];
    const chosen = listed.find((entry) => sameName(entry.name, details.organisation));
    const typeIt = typing || (purpose !== null && listed.length === 0 && purpose.allowOther);
    const noun = purpose?.organisationLabel.toLowerCase() || 'organisation';
    const pick = (id: string) => {
      if (id === TYPE_IT) {
        setTyping(true);
        change({ organisation: '', organisationId: null, typedIn: true });
        return;
      }
      const entry = listed.find((item) => item.id === id);
      if (!entry) return;
      const saved = [entry.addressLine1, entry.addressLine2, entry.postcode, entry.city, entry.state, entry.country].some(Boolean);
      change({
        organisation: entry.name,
        organisationId: entry.id,
        typedIn: false,
        ...(saved && question.askAddress !== false
          ? { addressLine1: entry.addressLine1, addressLine2: entry.addressLine2, postcode: entry.postcode, city: entry.city, state: entry.state, country: entry.country || MALAYSIA }
          : {}),
      });
    };
    return (
      <React.Fragment key="recipient">
        <FormRow label="Purpose" htmlFor="letter-form-purpose" required error={errors.purpose}>
          <SelectMenu
            id="letter-form-purpose"
            value={details.purpose}
            placeholder="Choose an option"
            searchPlaceholder={question.options.length > 7 ? 'Search' : undefined}
            options={question.options.map((option) => ({ value: option.code, label: option.label }))}
            disabled={off}
            aria-invalid={errors.purpose ? true : undefined}
            onChange={(code) => {
              if (code === details.purpose) return;
              setTyping(false);
              change({ purpose: code, organisation: '', organisationId: null, typedIn: false });
            }}
          />
        </FormRow>
        <FormRow
          label="Recipient"
          htmlFor="letter-form-organisation"
          required
          hint={typeIt ? `Type the full name of the ${noun}` : chosen && [chosen.addressLine1, chosen.city].some(Boolean) ? 'Its saved address is filled in below' : undefined}
          error={errors.organisation}
        >
          {typeIt ? (
            <input
              id="letter-form-organisation"
              type="text"
              value={details.organisation}
              maxLength={160}
              disabled={off}
              onChange={(event) => change({ organisation: event.target.value, organisationId: null, typedIn: true })}
              aria-invalid={errors.organisation ? true : undefined}
              aria-describedby="letter-form-organisation-hint"
              className={`form-control form-control-md ${errors.organisation ? 'form-control-error' : ''}`}
            />
          ) : (
            <SelectMenu
              id="letter-form-organisation"
              value={chosen?.id ?? ''}
              placeholder={purpose ? 'Choose an option' : 'Choose a purpose first'}
              searchPlaceholder="Search"
              options={[
                ...listed.map((entry) => ({ value: entry.id, label: entry.name })),
                ...(purpose?.allowOther ? [{ value: TYPE_IT, label: 'Not in the list? Type the name' }] : []),
              ]}
              disabled={off || !purpose}
              aria-invalid={errors.organisation ? true : undefined}
              onChange={pick}
            />
          )}
          {typing && listed.length > 0 && !off && (
            <button
              type="button"
              onClick={() => {
                setTyping(false);
                change({ organisation: '', organisationId: null, typedIn: false });
              }}
              className="text-[12px] font-semibold text-blue-700 hover:underline cursor-pointer"
            >
              Choose from the list instead
            </button>
          )}
        </FormRow>
        {question.askAddress !== false &&
          ADDRESS_ROWS.map((row) => (
            <FormRow key={row.field} label={row.label} htmlFor={`letter-form-${row.field}`} required={Boolean(row.missing)} hint={row.hint} error={errors[row.field]}>
              <input
                id={`letter-form-${row.field}`}
                type="text"
                value={String(details[row.field] ?? '')}
                maxLength={120}
                disabled={off}
                onChange={(event) => change({ [row.field]: event.target.value })}
                aria-required={row.missing ? true : undefined}
                aria-invalid={errors[row.field] ? true : undefined}
                aria-describedby={`letter-form-${row.field}-hint`}
                className={`form-control form-control-md ${row.narrow ? 'sm:max-w-[10rem]' : ''} ${errors[row.field] ? 'form-control-error' : ''}`}
              />
            </FormRow>
          ))}
        {question.askAddress !== false && asksState(details.country) && (
          <FormRow label="State" htmlFor="letter-form-state" required hint="Choose recipient state" error={errors.state}>
            <SelectMenu
              id="letter-form-state"
              value={MALAYSIAN_STATES.includes(details.state) ? details.state : ''}
              placeholder="Choose a state"
              options={STATE_OPTIONS}
              disabled={off}
              aria-required
              aria-invalid={errors.state ? true : undefined}
              aria-describedby="letter-form-state-hint"
              onChange={(state) => change({ state })}
            />
          </FormRow>
        )}
        {question.askAddress !== false && (
          <FormRow label="Country" htmlFor="letter-form-country" required hint="Choose recipient country" error={errors.country}>
            <SelectMenu
              id="letter-form-country"
              value={COUNTRIES.includes(details.country) ? details.country : ''}
              placeholder="Choose a country"
              searchPlaceholder="Search"
              options={COUNTRY_OPTIONS}
              disabled={off}
              aria-required
              aria-invalid={errors.country ? true : undefined}
              aria-describedby="letter-form-country-hint"
              onChange={(country) => change({ country, state: asksState(country) ? details.state : '' })}
            />
          </FormRow>
        )}
      </React.Fragment>
    );
  };

  const questionRow = (question: LetterFormQuestion, index: number) => {
    if (question.kind === 'recipient') return recipientRows(question);
    if (question.kind === 'extras') {
      return (
        <FormRow key="extras" label="Additional Information" hint="Shown on the letter" error={errors.include}>
          <div className="space-y-3 sm:pt-3">
            {question.options.map((option) => (
              <label key={option.code} className="flex items-center gap-2.5 text-[13px] font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] accent-brand-navy"
                  checked={details.include.includes(option.code)}
                  disabled={off}
                  onChange={() =>
                    change({
                      include: details.include.includes(option.code)
                        ? details.include.filter((code) => code !== option.code)
                        : [...details.include, option.code],
                    })
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </FormRow>
      );
    }
    const name = question.name ?? `question-${index}`;
    const id = `letter-form-answer-${name}`;
    const error = errors[`answer:${name}`];
    const value = answers[name];
    if (question.kind === 'yesno') {
      return (
        <FormRow key={name} label={question.label ?? ''} hint={question.hint || undefined} error={error}>
          <div role="radiogroup" aria-label={question.label} className="flex gap-6 sm:pt-3">
            {[true, false].map((option) => (
              <label key={String(option)} className="flex items-center gap-2 text-[13px] font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name={id}
                  className="h-4 w-4 accent-brand-navy"
                  checked={(value === true) === option}
                  disabled={off}
                  onChange={() => onAnswer(name, option)}
                />
                {option ? 'Yes' : 'No'}
              </label>
            ))}
          </div>
        </FormRow>
      );
    }
    if (question.kind === 'choice') {
      const items = question.list.items;
      return (
        <FormRow key={name} label={question.label ?? ''} htmlFor={id} required={question.required} hint={question.hint || undefined} error={error}>
          <SelectMenu
            id={id}
            value={typeof value === 'string' ? value : ''}
            placeholder={items.length ? 'Choose an option' : `No ${question.list.itemNoun.toLowerCase()} listed yet`}
            searchPlaceholder={items.length > 7 ? 'Search' : undefined}
            options={items.map((item) => ({ value: item.id, label: item.name }))}
            disabled={off || items.length === 0}
            aria-invalid={error ? true : undefined}
            onChange={(next) => onAnswer(name, next)}
          />
        </FormRow>
      );
    }
    return (
      <FormRow key={name} label={question.label ?? ''} htmlFor={id} required={question.required} hint={question.hint || undefined} error={error}>
        <input
          id={id}
          type={question.kind === 'date' ? 'date' : 'text'}
          value={typeof value === 'string' ? value : ''}
          maxLength={question.kind === 'date' ? undefined : 300}
          disabled={off}
          onChange={(event) => onAnswer(name, event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={question.hint ? `${id}-hint` : undefined}
          className={`form-control form-control-md ${question.kind === 'date' ? 'sm:max-w-[14rem]' : ''} ${error ? 'form-control-error' : ''}`}
        />
      </FormRow>
    );
  };

  return (
    <Compact.Provider value={preview}>
      <FormRow label="Programme" htmlFor="letter-form-programme" hint="From your student record">
        <input
          id="letter-form-programme"
          type="text"
          readOnly
          value={programme || '-'}
          aria-describedby="letter-form-programme-hint"
          className="form-control form-control-md bg-slate-50 text-slate-600"
        />
      </FormRow>
      {questions.map(questionRow)}
      <FormRow label="Application Date">
        <p className="text-[13px] font-medium text-slate-700 sm:pt-3">{applicationDate}</p>
      </FormRow>
    </Compact.Provider>
  );
};

/** The answers to send: only the office's own questions, by tag name. */
export function answersFor(questions: readonly LetterFormQuestion[], answers: LetterAnswers): LetterAnswers {
  const sent: LetterAnswers = {};
  for (const question of questions) {
    if (question.kind === 'recipient' || question.kind === 'extras' || !question.name) continue;
    const value = answers[question.name];
    if (question.kind === 'yesno') sent[question.name] = value === true;
    else if (typeof value === 'string' && value.trim()) sent[question.name] = value.trim();
  }
  return sent;
}

/** What the student must still answer before sending, by field. */
export function missingAnswers(questions: readonly LetterFormQuestion[], details: LetterRequestDetails, answers: LetterAnswers) {
  const problems: Record<string, string> = {};
  for (const question of questions) {
    if (question.kind === 'recipient') {
      const purpose = question.options.find((option) => option.code === details.purpose);
      if (!purpose) problems.purpose = 'Choose what the letter is for.';
      else if (!details.organisation.trim()) problems.organisation = `Choose or type the ${purpose.organisationLabel.toLowerCase() || 'organisation'}.`;
      if (question.askAddress !== false) {
        for (const row of ADDRESS_ROWS) {
          if (row.missing && !String(details[row.field] ?? '').trim()) problems[row.field] = row.missing;
        }
        if (asksState(details.country) && !MALAYSIAN_STATES.includes(details.state)) problems.state = 'Choose the state.';
        if (!COUNTRIES.includes(details.country)) problems.country = 'Choose the country.';
      }
    } else if (question.kind !== 'extras' && question.kind !== 'yesno' && question.required && question.name) {
      const value = answers[question.name];
      if (typeof value !== 'string' || !value.trim()) problems[`answer:${question.name}`] = question.kind === 'choice' ? 'Choose one.' : 'Answer this question.';
    }
  }
  return problems;
}
