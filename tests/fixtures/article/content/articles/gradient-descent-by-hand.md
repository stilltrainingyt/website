---
# The design's article page, written as the article's file over the step 7 sample of the same
# article: its lede as the summary, its text as Markdown, and the design's own markup where
# Markdown has none (the pull quote, the step cards, the plain list, the bold "The check.").
title: "Gradient descent, by hand"
published: 2026-10-27
updated: 2026-11-02
track: foundations
topic: ai
summary: "A model learns by walking downhill on a curve it cannot see. Here is the walk, three steps of it, done with a pencil."
video: episodes/gradient-descent-by-hand
---
A model starts as a list of random numbers called weights. It has one way of finding out how it is doing: a single number that says how wrong its answers are. Call that number the loss. Training means changing the weights until the loss is small.

Take a model with only one weight. Put the value of the weight along the floor and the loss up the wall, and you get a curve. For this example the curve is a bowl: the loss is (weight − 3) × (weight − 3). The bottom of the bowl, where the model is least wrong, sits at weight 3.

The model cannot see the bowl. It only knows where it is standing and which way the ground tilts under it. That tilt is the slope. For this bowl, the slope at any weight is 2 × (weight − 3). A positive slope means the ground rises to the right, so downhill is to the left.

<p class="pull">Step against the slope. That is the whole rule.</p>

Written out: new weight = old weight − step size × slope. The step size is a number you pick before you start. Here it is 0.3, and the walk starts at weight 7.5.

<div class="stepcards"><div class="stepcard"><span class="lab">Step 1</span>
      <div class="ln"><span>Weight before the step</span><b>7.50</b></div>
      <div class="ln"><span>Slope at that weight</span><b>2 × 4.50 = 9.00</b></div>
      <div class="ln"><span>Step size × slope</span><b>0.3 × 9.00 = 2.70</b></div>
      <div class="ln"><span>Weight after the step</span><b>7.50 − 2.70 = 4.80</b></div>
      <div class="ln"><span>How wrong it is now</span><b>3.24</b></div></div><div class="stepcard"><span class="lab">Step 2</span>
      <div class="ln"><span>Weight before the step</span><b>4.80</b></div>
      <div class="ln"><span>Slope at that weight</span><b>2 × 1.80 = 3.60</b></div>
      <div class="ln"><span>Step size × slope</span><b>0.3 × 3.60 = 1.08</b></div>
      <div class="ln"><span>Weight after the step</span><b>4.80 − 1.08 = 3.72</b></div>
      <div class="ln"><span>How wrong it is now</span><b>0.52</b></div></div><div class="stepcard"><span class="lab">Step 3</span>
      <div class="ln"><span>Weight before the step</span><b>3.72</b></div>
      <div class="ln"><span>Slope at that weight</span><b>2 × 0.72 = 1.44</b></div>
      <div class="ln"><span>Step size × slope</span><b>0.3 × 1.44 = 0.43</b></div>
      <div class="ln"><span>Weight after the step</span><b>3.72 − 0.43 = 3.29</b></div>
      <div class="ln"><span>How wrong it is now</span><b>0.08</b></div></div></div>

<b>The check.</b> The distance from the bottom goes 4.50, then 1.80, then 0.72, then 0.29. Each step keeps exactly 0.4 of the distance that was left, because 1 − 2 × 0.3 = 0.4. The steps shrink on their own, because the ground flattens near the bottom.

### Choosing the step size

That same sum explains what goes wrong. Each step multiplies the distance from the bottom by 1 − 2 × step size.

<ul class="plain">
    <li>Step size 0.5 gives 1 − 1 = 0. The walk lands on the bottom in one step.</li>
    <li>Step size 1.0 gives 1 − 2 = −1. Same distance, other side, forever. The walk bounces between two points.</li>
    <li>Step size 1.1 gives −1.2. Every step lands further out than the last, and the walk leaves the page.</li>
  </ul>

Real curves are not this tidy, so nobody can work out the perfect step size in advance. People try a few and watch the loss.

### What it costs

To know the slope, the model has to measure how wrong it is, which means running training examples through it. In the plainest version one step needs every example; in practice models take a small batch at a time so each step is cheaper. A real model has billions of weights instead of one, and each weight gets its own slope, but the rule for every one of them is the line above.
