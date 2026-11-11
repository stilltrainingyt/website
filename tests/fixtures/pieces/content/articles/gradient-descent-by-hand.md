---
title: "Gradient descent, by hand"
published: 2026-10-27
track: foundations
topic: ai
summary: "How a model learns by walking downhill, worked out with a pencil and three steps."
video: episodes/gradient-descent-by-hand
---
A model learns by stepping downhill on a curve it cannot see. This article does three of those steps with a pencil, so every number can be checked.

Start with the simplest curve there is: the error is the square of the distance from the bottom. Wherever the weight sits, the slope there is two times that distance, and it points uphill. So the model steps the other way.

The size of each step is the slope times a small number, the step size. With a step size of 0.3, each step takes away 0.6 of the distance to the bottom: 4.50, then 1.80, then 0.72, then 0.29.

That same sum explains what goes wrong. A step size of 0.5 lands on the bottom in one step. A step size of 1.0 lands on the other side, the same distance out, forever. Anything bigger walks further out with every step.

Real curves are not this tidy, so nobody can work out the perfect step size in advance. People try a few and watch what the error does.

To know the slope, the model has to measure how wrong it is, which means running the training data through it. That is the cost of every single step.
