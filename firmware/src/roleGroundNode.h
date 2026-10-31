#ifndef ROLE_GROUND_NODE_H
#define ROLE_GROUND_NODE_H

#include <Arduino.h>
#include "messageProtocol.h"

void initGroundNode();
void updateGroundNode();
void handleGroundNodeIncoming(const SkyMessage& msg);
void triggerGroundNodeSend(const char* payload, const char* priority = "ROUTINE");

#endif // ROLE_GROUND_NODE_H
