"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

export default function DevButtonsGalleryPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Button Component Design System Gallery
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Visual testing harness for all button variants, sizes, icon alignments, loading, and stress states.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icons.ArrowCounterClockwise />}
              onClick={() => setLoading(!loading)}
            >
              Toggle Loading ({loading ? "ON" : "OFF"})
            </Button>
          </div>
        </div>

        {/* 1. Variants Showcase (md size) */}
        <section className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
            1. Variants (Size: Medium, 44px height)
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" leadingIcon={<Icons.UserPlus />}>
              Primary Teal
            </Button>
            <Button variant="secondary" leadingIcon={<Icons.Door />}>
              Secondary White
            </Button>
            <Button variant="outline" leadingIcon={<Icons.PencilSimple />}>
              Outline Alias
            </Button>
            <Button variant="ghost" leadingIcon={<Icons.Funnel />}>
              Ghost Button
            </Button>
            <Button variant="warning-outline" leadingIcon={<Icons.ArrowCounterClockwise />}>
              Warning Outline (Reset)
            </Button>
            <Button variant="destructive-outline" leadingIcon={<Icons.Trash />}>
              Destructive Outline
            </Button>
            <Button variant="destructive" leadingIcon={<Icons.Trash />}>
              Destructive Solid (Confirm)
            </Button>
            <Button variant="link">
              Link Text Button
            </Button>
          </div>
        </section>

        {/* 2. Sizes Showcase */}
        <section className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
            2. Fixed Sizes (Small: 36px, Medium: 44px, Large: 48px)
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="w-24 text-xs font-mono text-slate-500">Small (36px):</span>
              <Button size="sm" variant="primary" leadingIcon={<Icons.Plus />}>
                Register Practitioner
              </Button>
              <Button size="sm" variant="secondary" leadingIcon={<Icons.Door />}>
                Assign Room
              </Button>
              <Button size="sm" variant="warning-outline" leadingIcon={<Icons.ArrowCounterClockwise />}>
                Reset Password
              </Button>
              <Button size="icon-sm" variant="ghost" title="More Options">
                <Icons.DotsThreeVertical />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-xs font-mono text-slate-500">Medium (44px):</span>
              <Button size="md" variant="primary" leadingIcon={<Icons.Plus />}>
                Register Practitioner
              </Button>
              <Button size="md" variant="secondary" leadingIcon={<Icons.Door />}>
                Assign Room
              </Button>
              <Button size="md" variant="warning-outline" leadingIcon={<Icons.ArrowCounterClockwise />}>
                Reset Password
              </Button>
              <Button size="md" variant="icon" title="More Options">
                <Icons.DotsThreeVertical />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <span className="w-24 text-xs font-mono text-slate-500">Large (48px):</span>
              <Button size="lg" variant="primary" leadingIcon={<Icons.Plus />}>
                Register Practitioner
              </Button>
              <Button size="lg" variant="secondary" leadingIcon={<Icons.Door />}>
                Assign Room
              </Button>
              <Button size="lg" variant="destructive-outline" leadingIcon={<Icons.Trash />}>
                Delete Account
              </Button>
            </div>
          </div>
        </section>

        {/* 3. Icon Alignments */}
        <section className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
            3. Icon Positions (Leading, Trailing, Both, Show Arrow)
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" leadingIcon={<Icons.DownloadSimple />}>
              Leading Icon Only
            </Button>
            <Button variant="secondary" trailingIcon={<Icons.CaretDown />}>
              Trailing Icon Only
            </Button>
            <Button variant="secondary" leadingIcon={<Icons.CalendarBlank />} trailingIcon={<Icons.CaretDown />}>
              Both Leading & Trailing
            </Button>
            <Button variant="primary" showArrow>
              Continue to Step 2
            </Button>
          </div>
        </section>

        {/* 4. Interactive States (Loading, Disabled) */}
        <section className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
            4. Interactive States: Loading & Disabled
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" isLoading={loading} leadingIcon={<Icons.Check />}>
              Save Changes
            </Button>
            <Button variant="secondary" isLoading={loading} leadingIcon={<Icons.DownloadSimple />}>
              Export Report
            </Button>
            <Button variant="primary" disabled leadingIcon={<Icons.Plus />}>
              Disabled Primary
            </Button>
            <Button variant="secondary" disabled leadingIcon={<Icons.Door />}>
              Disabled Secondary
            </Button>
            <Button variant="destructive" disabled leadingIcon={<Icons.Trash />}>
              Disabled Destructive
            </Button>
          </div>
        </section>

        {/* 5. Icon-Only Buttons */}
        <section className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
            5. Square Icon-Only Buttons (40px standard, 36px compact)
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">40px Standard:</span>
              <Button size="icon" variant="secondary" title="View details" aria-label="View details">
                <Icons.Eye />
              </Button>
              <Button size="icon" variant="ghost" title="More options" aria-label="More options">
                <Icons.DotsThreeVertical />
              </Button>
              <Button size="icon" variant="warning-outline" title="Reset user" aria-label="Reset user">
                <Icons.ArrowCounterClockwise />
              </Button>
              <Button size="icon" variant="destructive-outline" title="Delete record" aria-label="Delete record">
                <Icons.Trash />
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-8">
              <span className="text-xs text-slate-500 font-mono">36px Table Kebab:</span>
              <Button size="icon-sm" variant="secondary" title="More options" aria-label="More options">
                <Icons.DotsThreeVertical />
              </Button>
              <Button size="icon-sm" variant="ghost" title="Close" aria-label="Close">
                <Icons.X />
              </Button>
            </div>
          </div>
        </section>

        {/* 6. Stress Tests: Narrow Containers & Long Text */}
        <section className="bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
            6. Stress Tests: Narrow Containers & Long Text (Never Wrap onto Two Lines)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-dashed border-slate-300 p-4 space-y-2 max-w-[200px]">
              <p className="text-xs font-mono text-slate-500">Container Max Width: 200px</p>
              <Button size="sm" variant="primary" leadingIcon={<Icons.UserPlus />} className="w-full">
                Extremely Long Button Label That Truncates
              </Button>
            </div>

            <div className="border border-dashed border-slate-300 p-4 space-y-2 max-w-[150px]">
              <p className="text-xs font-mono text-slate-500">Container Max Width: 150px</p>
              <Button size="sm" variant="secondary" leadingIcon={<Icons.Door />} className="w-full">
                Assign Room Now
              </Button>
            </div>

            <div className="border border-dashed border-slate-300 p-4 space-y-2 max-w-[240px]">
              <p className="text-xs font-mono text-slate-500">Table Action Pair (220px)</p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" leadingIcon={<Icons.Door />}>
                  Assign room
                </Button>
                <Button size="icon-sm" variant="ghost" title="More options" aria-label="More options">
                  <Icons.DotsThreeVertical />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
