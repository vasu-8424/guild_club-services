const fs = require('fs');
const path = require('path');

// 1. Update src/app/(auth)/login/page.tsx
{
  const loginPath = path.join('src', 'app', '(auth)', 'login', 'page.tsx');
  let content = fs.readFileSync(loginPath, 'utf8');

  if (!content.includes('import Image from "next/image"')) {
    content = content.replace(
      'import * as React from "react";',
      'import * as React from "react";\nimport Image from "next/image";'
    );
  }

  // Replace desktop icon
  content = content.replace(
    /<div className="flex h-10 w-10 items-center justify-center rounded-none bg-\[#0B7A63\] text-white shadow-xs">[\s\S]*?<Icons\.Analytics className="h-6 w-6" \/>[\s\S]*?<\/div>/,
    `<div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden shadow-md border border-amber-500/20 bg-slate-900 shrink-0">
            <Image src="/logo.png" alt="Guild Club Services" width={48} height={48} priority className="h-full w-full object-cover" />
          </div>`
  );

  // Replace mobile icon
  content = content.replace(
    /<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-none bg-\[#0B7A63\] text-white shadow-xs mb-3">[\s\S]*?<Icons\.Analytics className="h-6 w-6" \/>[\s\S]*?<\/div>/,
    `<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full overflow-hidden shadow-lg border-2 border-amber-500/30 bg-slate-900 mb-3">
              <Image src="/logo.png" alt="Guild Club Services" width={64} height={64} priority className="h-full w-full object-cover" />
            </div>`
  );

  fs.writeFileSync(loginPath, content, 'utf8');
  console.log('✅ Updated login page with official logo.');
}

// 2. Update src/components/layout/topbar.tsx
{
  const topbarPath = path.join('src', 'components', 'layout', 'topbar.tsx');
  let content = fs.readFileSync(topbarPath, 'utf8');

  if (!content.includes('import Image from "next/image"')) {
    content = content.replace(
      'import * as React from "react";',
      'import * as React from "react";\nimport Image from "next/image";'
    );
  }

  // Add logo on root pages inside the topbar header
  if (!content.includes('data-testid="topbar-logo"')) {
    const target = `{isInnerPage && (
          <button
            type="button"
            onClick={handleBack}`;

    const replacement = `{!isInnerPage && (
          <div data-testid="topbar-logo" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-slate-900 shadow-xs mr-0.5">
            <Image src="/logo.png" alt="Guild Club Services" width={32} height={32} priority className="h-full w-full object-cover" />
          </div>
        )}
        {isInnerPage && (
          <button
            type="button"
            onClick={handleBack}`;

    content = content.replace(target, replacement);
    fs.writeFileSync(topbarPath, content, 'utf8');
    console.log('✅ Updated topbar with official logo.');
  }
}

// 3. Update src/app/offline/page.tsx
{
  const offlinePath = path.join('src', 'app', 'offline', 'page.tsx');
  if (fs.existsSync(offlinePath)) {
    let content = fs.readFileSync(offlinePath, 'utf8');
    if (!content.includes('import Image from "next/image"')) {
      content = content.replace(
        'import React from "react";',
        'import React from "react";\nimport Image from "next/image";'
      );
    }
    content = content.replace(
      /<div className="w-16 h-16 bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center mx-auto shadow-xs">[\s\S]*?<WifiOff className="w-8 h-8 text-\[#0B7A63\]" \/>[\s\S]*?<\/div>/,
      `<div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-full overflow-hidden shadow-md border-2 border-amber-500/30 bg-slate-900">
            <Image src="/logo.png" alt="Guild Club Services" width={80} height={80} priority className="h-full w-full object-cover" />
          </div>
          <div className="w-10 h-10 bg-stone-100 border border-stone-200 text-stone-600 flex items-center justify-center shadow-xs">
            <WifiOff className="w-5 h-5 text-[#0B7A63]" />
          </div>
        </div>`
    );
    fs.writeFileSync(offlinePath, content, 'utf8');
    console.log('✅ Updated offline page with official logo.');
  }
}

// 4. Update src/components/pwa/install-prompt-card.tsx
{
  const installPath = path.join('src', 'components', 'pwa', 'install-prompt-card.tsx');
  if (fs.existsSync(installPath)) {
    let content = fs.readFileSync(installPath, 'utf8');
    if (!content.includes('import Image from "next/image"')) {
      content = content.replace(
        'import * as React from "react";',
        'import * as React from "react";\nimport Image from "next/image";'
      );
    }
    content = content.replace(
      /<div className="w-10 h-10 shrink-0 bg-\[#0B7A63\] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">[\s\S]*?GCS[\s\S]*?<\/div>/,
      `<div className="w-11 h-11 shrink-0 rounded-full overflow-hidden shadow-sm border border-amber-500/30 bg-slate-900">
            <Image src="/logo.png" alt="Guild Club Services" width={44} height={44} className="h-full w-full object-cover" />
          </div>`
    );
    fs.writeFileSync(installPath, content, 'utf8');
    console.log('✅ Updated install prompt card with official logo.');
  }
}

// 5. Update src/app/(dashboard)/therapist/profile/page.tsx
{
  const profilePath = path.join('src', 'app', '(dashboard)', 'therapist', 'profile', 'page.tsx');
  if (fs.existsSync(profilePath)) {
    let content = fs.readFileSync(profilePath, 'utf8');
    if (!content.includes('import Image from "next/image"')) {
      content = content.replace(
        'import React from "react";',
        'import React from "react";\nimport Image from "next/image";'
      );
    }
    // Add official logo to the App Settings & System card
    if (!content.includes('Guild Club Services System Emblem')) {
      const target = `<div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#0B7A63]" />
            <h3 className="text-[14px] font-bold uppercase tracking-wide text-stone-900">
              App Settings & System
            </h3>
          </div>`;

      const replacement = `<div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#0B7A63]" />
              <h3 className="text-[14px] font-bold uppercase tracking-wide text-stone-900">
                App Settings & System
              </h3>
            </div>
            <div className="w-6 h-6 rounded-full overflow-hidden border border-amber-500/30 bg-slate-900 shadow-xs">
              <Image src="/logo.png" alt="Guild Club Services System Emblem" width={24} height={24} className="h-full w-full object-cover" />
            </div>
          </div>`;

      content = content.replace(target, replacement);
      fs.writeFileSync(profilePath, content, 'utf8');
      console.log('✅ Updated profile page with official logo.');
    }
  }
}

// 6. Update src/components/cases/case-progress-report.tsx
{
  const reportPath = path.join('src', 'components', 'cases', 'case-progress-report.tsx');
  if (fs.existsSync(reportPath)) {
    let content = fs.readFileSync(reportPath, 'utf8');
    if (!content.includes('import Image from "next/image"')) {
      content = content.replace(
        'import React from "react";',
        'import React from "react";\nimport Image from "next/image";'
      );
    }

    if (!content.includes('alt="Guild Club Seal"')) {
      const oldHeader = `<div className="flex items-start justify-between border-b-2 border-stone-900 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight uppercase text-stone-900">
                  Guild Club Services
                </span>`;

      const newHeader = `<div className="flex items-start justify-between border-b-2 border-stone-900 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-amber-500/30 bg-slate-900 shrink-0">
                <Image src="/logo.png" alt="Guild Club Seal" width={48} height={48} priority className="h-full w-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight uppercase text-stone-900">
                    Guild Club Services
                  </span>`;

      content = content.replace(oldHeader, newHeader);
      fs.writeFileSync(reportPath, content, 'utf8');
      console.log('✅ Updated case progress report with official logo.');
    }
  }
}
