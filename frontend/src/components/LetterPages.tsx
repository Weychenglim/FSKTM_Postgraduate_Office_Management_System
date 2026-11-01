/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A letter laid out on A4 sheets, scaled to fit the space it is shown in. A
// letter too long for one sheet continues on the next, as it would in print.
// The Malay page of a bilingual letter is a second LetterPages in Malay.

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { LETTERHEAD, LETTER_WORDS, malayLetterDate, type LetterLanguage } from '../utils/letterDocument';
import { A4_CONTENT_WIDTH, A4_PAGE, paginateBlocks, splitLetterBlocks } from '../utils/letterPages';

interface LetterPagesProps {
  /** What "Our Ref" shows; the plain reference goes in each page footer. */
  reference: React.ReactNode;
  referenceText: string;
  date: string;
  /** Letter body already rendered with renderLetterBodyHtml. */
  bodyHtml: string;
  /** The closing lines; the faculty defaults when left out. */
  closing?: {
    disclaimer: string;
    malayDisclaimer?: string;
    signatoryName: string;
    signatoryOffice: string;
    malaySignatoryName?: string;
    malaySignatoryOffice?: string;
  };
  /** The Malay page prints its labels, date and disclaimer in Malay. */
  language?: LetterLanguage;
  /** The Malay page's body, shown after the English pages when there is one. */
  malayBodyHtml?: string;
}

const DEFAULT_CLOSING: NonNullable<LetterPagesProps['closing']> = {
  disclaimer: LETTERHEAD.disclaimer,
  signatoryName: LETTERHEAD.signatoryName,
  signatoryOffice: LETTERHEAD.signatoryOffice,
};

const Letterhead: React.FC<{ malay: boolean }> = ({ malay }) => (
  <div className="border-b-2 border-double border-slate-800 pb-4 mb-7 flex items-center justify-between gap-6">
    <div className="flex items-center gap-4">
      <img src={LETTERHEAD.logoPath} alt="Universiti Malaya" className="h-[45px] w-auto object-contain" />
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight block max-w-[170px]">
        {malay ? LETTERHEAD.malayFaculty : LETTERHEAD.faculty}
      </span>
    </div>
    <div className="text-right text-[10px] font-bold text-slate-400 leading-relaxed">
      {(malay ? LETTERHEAD.malayAddressLines : LETTERHEAD.addressLines).map((line) => (
        <span key={line} className="block">{line}</span>
      ))}
    </div>
  </div>
);

const Signature: React.FC<{ name: string; office: string; stamp: string }> = ({ name, office, stamp }) => (
  <div className="pt-12">
    <div className="w-40 border-b border-slate-400 h-6" />
    <p className="mt-2 font-extrabold text-[14px] text-slate-900">{name}</p>
    <p className="text-slate-400 uppercase tracking-wide text-[10px] font-black leading-none mt-1">{office}</p>
    <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-600">
      <Info aria-hidden="true" className="w-3 h-3" />
      {stamp}
    </p>
  </div>
);

const LetterSheets: React.FC<Omit<LetterPagesProps, 'malayBodyHtml'>> = ({
  reference,
  referenceText,
  date,
  bodyHtml,
  closing = DEFAULT_CLOSING,
  language = 'en',
}) => {
  const words = LETTER_WORDS[language];
  const malay = language === 'ms';
  const disclaimer = malay ? closing.malayDisclaimer ?? LETTERHEAD.malayDisclaimer : closing.disclaimer;
  const signatoryName = malay ? closing.malaySignatoryName ?? LETTERHEAD.malaySignatoryName : closing.signatoryName;
  const signatoryOffice = malay ? closing.malaySignatoryOffice ?? LETTERHEAD.malaySignatoryOffice : closing.signatoryOffice;
  const frame = useRef<HTMLDivElement>(null);
  const measurer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(A4_PAGE.width);
  const [pages, setPages] = useState<number[][] | null>(null);

  const bodyBlocks = splitLetterBlocks(bodyHtml);
  const blocks: React.ReactNode[] = [
    <Letterhead key="letterhead" malay={malay} />,
    <div key="reference" className="flex flex-wrap justify-between items-baseline gap-x-6 gap-y-1 text-slate-600 mb-7">
      <div>{words.reference}: <span className="font-mono font-bold text-slate-800">{reference}</span></div>
      <div>{words.date}: <span className="font-bold text-slate-800">{malay ? malayLetterDate(date) : date}</span></div>
    </div>,
    ...bodyBlocks.map((html, index) => <div key={`body-${index}`} dangerouslySetInnerHTML={{ __html: html }} />),
    <p key="disclaimer" className="text-slate-500 font-semibold text-[11.5px] leading-relaxed mt-2">{disclaimer}</p>,
    <Signature key="signature" name={signatoryName} office={signatoryOffice} stamp={words.stamp} />,
  ];

  // Heights come from an unscaled, hidden copy of the content.
  const measure = useCallback(() => {
    const items = measurer.current?.children;
    if (!items) return;
    const heights = Array.from(items).map((item) => (item as HTMLElement).offsetHeight);
    setPages(paginateBlocks(heights));
  }, []);

  useLayoutEffect(() => {
    measure();
    let active = true;
    document.fonts?.ready.then(() => { if (active) measure(); });
    return () => { active = false; };
  }, [measure, bodyHtml, referenceText, date, disclaimer, signatoryName, signatoryOffice]);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const update = () => setWidth(Math.floor(element.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(1, width / A4_PAGE.width);
  const pageWidth = Math.floor(A4_PAGE.width * scale);
  const pageHeight = Math.floor(A4_PAGE.height * scale);
  const pageGroups = pages ?? [blocks.map((_, index) => index)];
  const contentClass = 'font-sans text-[14px] leading-[1.6] text-slate-700 text-left';

  return (
    <div className="w-full">
      {/* Hidden copy used only to measure each block at full size. Its
          zero-height box keeps it from ever adding a scrollbar. */}
      <div aria-hidden="true" className="h-0 overflow-hidden invisible">
        <div ref={measurer} className={contentClass} style={{ width: A4_CONTENT_WIDTH }}>
          {blocks.map((block, index) => (
            <div key={index} className="flow-root">{block}</div>
          ))}
        </div>
      </div>

      <div ref={frame} className="w-full">
      <div className="flex flex-col items-center gap-4">
        {pageGroups.map((group, pageIndex) => (
          <section
            key={pageIndex}
            aria-label={`${malay ? 'Malay page' : 'Page'} ${pageIndex + 1} of ${pageGroups.length}`}
            className="relative shrink-0 overflow-hidden bg-white border border-slate-200 shadow-sm"
            style={{ width: pageWidth, height: pageHeight }}
          >
            <div
              className={`absolute left-0 top-0 ${contentClass}`}
              style={{
                width: A4_PAGE.width,
                height: A4_PAGE.height,
                padding: `${A4_PAGE.marginY}px ${A4_PAGE.marginX}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {pageIndex > 0 && (
                <p className="text-[11px] font-semibold text-slate-400" style={{ height: A4_PAGE.continuation }}>
                  {words.reference}: <span className="font-mono">{referenceText}</span> ({words.continued})
                </p>
              )}
              {group.map((index) => (
                <div key={index} className="flow-root">{blocks[index]}</div>
              ))}
              <p
                className="absolute text-[10.5px] font-semibold text-slate-400 flex justify-between"
                style={{ left: A4_PAGE.marginX, right: A4_PAGE.marginX, bottom: A4_PAGE.marginY / 2 }}
              >
                <span className="font-mono">{referenceText}</span>
                <span>{words.page} {pageIndex + 1} {words.of} {pageGroups.length}</span>
              </p>
            </div>
          </section>
        ))}
      </div>
      </div>
    </div>
  );
};

export const LetterPages: React.FC<LetterPagesProps> = ({ malayBodyHtml, ...props }) =>
  malayBodyHtml ? (
    <div className="space-y-4">
      <LetterSheets {...props} />
      <LetterSheets {...props} bodyHtml={malayBodyHtml} language="ms" />
    </div>
  ) : (
    <LetterSheets {...props} />
  );
