import test from 'node:test';
import assert from 'node:assert/strict';
import {cardPeriod,submissionOpen,reviewOpen,lastSunday,fragments,mood,localClock} from '../lib/cards.ts';
test('daily logs close exactly at midnight in the saved timezone',()=>{
 assert.equal(submissionOpen('iRead','2026-11-25',new Date('2026-11-25T15:59:59Z'),'Asia/Manila'),true);
 assert.equal(submissionOpen('iRead','2026-11-25',new Date('2026-11-25T16:00:00Z'),'Asia/Manila'),false);
 assert.equal(submissionOpen('iRead','2026-11-26',new Date('2026-11-25T15:59:59Z'),'Asia/Manila'),false);
 assert.equal(submissionOpen('iPray','2026-11-24',new Date('2026-11-25T05:00:00Z'),'Asia/Manila'),false);
 assert.equal(localClock(new Date('2026-11-25T16:30:00Z'),'Asia/Bangkok').day,'2026-11-25');
});
test('Saturday entries belong to the coming Sunday service',()=>{
 assert.equal(cardPeriod('iRate','2026-11-28'),'2026-11-29');
 assert.equal(cardPeriod('iRate','2026-11-29'),'2026-11-29');
 assert.equal(submissionOpen('iRate','2026-11-29',new Date('2026-11-28T23:59:59Z')),true);
 assert.equal(submissionOpen('iRate','2026-11-29',new Date('2026-11-29T00:00:00Z')),false);
 assert.equal(submissionOpen('iRate','2026-11-29',new Date('2026-11-27T15:59:59Z')),false);
});
test('review windows open at cutoff and close at the exact end',()=>{
 assert.equal(reviewOpen('iRate','2026-11-29',new Date('2026-11-29T00:00:00Z')),true);
 assert.equal(reviewOpen('iRate','2026-11-29',new Date('2026-11-29T00:29:59Z')),true);
 assert.equal(reviewOpen('iRate','2026-11-29',new Date('2026-11-29T00:30:00Z')),false);
 assert.equal(reviewOpen('iRead','2026-11-29',new Date('2026-11-29T00:01:00Z')),false);
 assert.equal(submissionOpen('iNote','2026-11-29',new Date('2026-11-29T08:59:59Z')),true);
 assert.equal(submissionOpen('iNote','2026-11-29',new Date('2026-11-29T09:00:00Z')),false);
});
test('monthly sharing uses the last Sunday including year and February boundaries',()=>{
 assert.equal(lastSunday('2026-11'),'2026-11-29');assert.equal(lastSunday('2027-02'),'2027-02-28');
 assert.equal(submissionOpen('iShare','2026-11',new Date('2026-11-29T00:00:00Z')),false);
 assert.equal(reviewOpen('iShare','2026-11',new Date('2026-11-29T00:00:00Z')),true);
 assert.equal(reviewOpen('iShare','2026-11',new Date('2026-11-29T10:00:00Z')),false);
});
test('fragment totals use unique binary activities and mood resets after completion',()=>{
 assert.equal(fragments('iRead',{activities:['Read the Bible','Read the Bible','Watch Recordings','invalid']}),2);
 assert.equal(fragments('iPray',{morning:true,adhoc:false,evening:true}),2);
 assert.equal(fragments('iPray',{morning:'true'}),0);
 assert.equal(mood(20),'happy');assert.equal(mood(21),'sad');assert.equal(mood(22),'disappointed');assert.equal(mood(23,true),'happy');
});
