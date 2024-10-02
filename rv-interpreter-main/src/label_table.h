#pragma once
typedef struct l_node {
  char *key;
  int value;
  struct l_node *next;
} l_node;

typedef struct {
  l_node *table[128];
} labeltable;

int lt_hash(char *key);
labeltable *lt_init(void);
void lt_insert(labeltable *lt, char *key, int value);
int lt_get(labeltable *lt, char *key);
void lt_free(labeltable *lt);
