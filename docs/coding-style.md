Talkyard Coding Style
=====================

All quotes below are from the Linux Kernel coding style [1].


### Indentation

> "The whole idea behind indentation is to clearly define where a block of control starts and ends. Especially when you've been looking at your screen for 20 straight hours, you'll find it a lot easier to see how the indentation works if you have large indentations."

And indeed: Scala's 2 spaces is annoying. Talkyard: Continuation indentation: 4 or 6 spaces.
Indented statements: 2 spaces as typical in Scala code.


### Lines and statements

> "Don't put multiple statements on a single line unless you have something to hide:"
>
> ```
> if (condition) do_this;
>   do_something_everytime;
> ```

200? 400? chars long lines, I have seen, Doing 5-6? different things on the same line.

That's horrible when trying to read that code GitHub:
Needs to scroll down to find the horizontal scrollbars, then scroll-scroll-scroll
rightwards, then scroll up-up-up past oceans of whitespace, trying too find
the long long line again. (Annoying to have to install better-layout plugins.)

Talkyard: Only one (or 2 if simple) things should happen per line.

Talkyard: Max 95 chars lines. Then you can have two editor tabs open side by side
on a 14'' 1920 px wide laptop.

> *"Avoid tricky expressions."*

> "Do not unnecessarily use braces where a single statement will do."

This is fine in Talkyard:

```
if (something)
  doTheThing();

otherStuff();
```

*as long as* after the `if` follows a blank line, or keyword like `else`, `return`
— then you see at a glance that the `if` is just one statement.


### Names

> "LOCAL variable names should be short, and to the point. If you have some random integer loop counter, it should probably be called i. Calling it loop_counter is non-productive, if there is no chance of it being mis-understood"


### Comments

Sometimes people are confused about comments. The kernel coding style is not:

> [Do not explain] HOW your code works [...]
> better to write the code so that the working is obvious [...]
>
> [Do tell] people what [the code] does, and possibly WHY it does it

There you go: Uppercase `WHY` explain why the code does what it does (when needed).

Also, sometimes you need to tell peolpe what the code does *Not* do — because there
can be many ways to do something, and you decided against the other ways, and did
like you did instead — whatfor? Is it important that others don't rewrite and
do the stuff in some of those other ways?

Is there something you thought about but avoided? For example, why did
you *Not* clear a certain cache? What are the reasons you know the cache
is not stale?

If you don't add some lines expalining why, then, a helpful person might
clear the cache, in the future — although was never needed.

> It's also important to comment [data structures]


1: https://github.com/torvalds/linux/blob/master/Documentation/process/coding-style.rst