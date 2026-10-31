#ifndef LOOP_PREVENTION_H
#define LOOP_PREVENTION_H

#include <Arduino.h>
#include "config.h"

class LoopPrevention {
public:
  LoopPrevention();
  bool alreadySeen(uint32_t msgID);
  void markSeen(uint32_t msgID);
  void clear();

private:
  uint32_t recentIDs[RECENT_ID_CAPACITY];
  uint8_t headIndex;
  uint8_t count;
};

extern LoopPrevention loopFilter;

#endif // LOOP_PREVENTION_H
