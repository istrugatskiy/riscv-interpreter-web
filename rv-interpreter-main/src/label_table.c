#include "label_table.h"
#include <ctype.h>
#include <stdlib.h>
#include <string.h>

int lt_hash(char *key) {
  unsigned long hash = 5381;
  int c;
  while ((c = *key++)) {
    hash = ((hash << 5) + hash) + c;
  }
  return (int)(hash % 128);
}

labeltable *lt_init(void) {
  labeltable *lt = malloc(sizeof(labeltable));
  for (int i = 0; i < 128; ++i) {
    lt->table[i] = NULL;
  }
  return lt;
}

void to_lowercase(char *str) {
  for (int i = 0; str[i]; ++i) {
    str[i] = tolower(str[i]);
  }
}

void lt_insert(labeltable *lt, char *key, int value) {
  char *lower_key = strdup(key);
  to_lowercase(lower_key);
  int index = lt_hash(lower_key);
  l_node *new_node = malloc(sizeof(l_node));
  new_node->key = lower_key;
  new_node->value = value;
  new_node->next = lt->table[index];
  lt->table[index] = new_node;
}

int lt_get(labeltable *lt, char *key) {
  char *lower_key = strdup(key);
  to_lowercase(lower_key);
  int index = lt_hash(lower_key);
  l_node *curr = lt->table[index];
  while (curr != NULL) {
    if (strcmp(curr->key, lower_key) == 0) {
      free(lower_key);
      return curr->value;
    }
    curr = curr->next;
  }
  free(lower_key);
  return -1;
}

void lt_free(labeltable *lt) {
  if (lt == NULL) {
    return;
  }

  for (int i = 0; i < 128; ++i) {
    l_node *curr = lt->table[i];
    while (curr != NULL) {
      l_node *temp = curr;
      curr = curr->next;
      free(temp);
    }
  }

  free(lt);
}
