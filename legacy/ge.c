#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <ctype.h>
#include <time.h>
#include <limits.h>
#include <unistd.h>


#include <windows.h>

#define LOCATIONS_FILE "assets\\locations.txt"
#define WEAPONS_FILE "assets\\weapons.txt"
#define ARMOURS_FILE "assets\\armour.txt"
#define CITY_WAYPOINTS_FILE "assets\\city_waypoints.txt"
#define ITEMS_FILE "assets\\items.txt"
#define EXPERIENCE_FILE "assets\\experience.txt"
#define MONSTERS_FILE "assets\\monsters.txt"
#define ACTIONS_FILE "assets\\actions.txt"
#define CITIES_FILE "assets\\cities.txt"
#define NPCS_FILE "assets\\npc.txt"
#define LOOT_FILE "assets\\loot.txt"
#define NUM_FILES 11                              // Number of files to load in
#define FILES {LOCATIONS_FILE, WEAPONS_FILE, ARMOURS_FILE,\
               CITY_WAYPOINTS_FILE, ITEMS_FILE, EXPERIENCE_FILE,\
               MONSTERS_FILE, ACTIONS_FILE, CITIES_FILE, NPCS_FILE,\
               LOOT_FILE}

#define SAVE_FILE "savefile.txt"

#define S_FILES {"savefile.txt", "savefile1.txt", "savefile2.txt",\
                    "savefile3.txt", "savefile4.txt"}
#define MAX_NUM_SAVEFILES 5

#define CHEST "Chest"
#define EQUIPMENT {WEAPON, CHEST, GLOVES, BOOTS}
#define NUM_EQUIPMENT 4

#define AR "AR"
#define ATK "Attack"
#define CRIT "Crit"
#define WEP_ENCHANTMENTS {AR, ATK, CRIT}
#define WEP_ENCHANT_PROB {50,  80,   20}
#define WEP_ENCHANT_MAX  { 3,  40,   20}
#define NUM_WEP_ENCHANTMENTS 3

#define DR "DR"
#define DEF "Def"
#define EVA "Evasion"
#define HP "Max HP"
#define ARM_ENCHANTMENTS {DR, DEF, EVA, HP}
#define ARM_ENCHANT_PROB {50,  80,  20, 20}
#define ARM_ENCHANT_MAX  { 3,  20,  15, 25}
#define NUM_ARM_ENCHANTMENTS 4

#define ENOVICE "Enchantment Chip Novice"
#define E84 "Enchantment Chip Level 84"
#define E88 "Enchantment Chip Level 88"
#define E92 "Enchantment Chip Level 92"
#define E96 "Enchantment Chip Level 96"
#define E100 "Enchantment Chip Level 100"
#define ENCHANTMENT_CHIPS {ENOVICE, E84, E88, E92, E96, E100}
#define NUM_ENCHANTMENT_CHIPS 6

#define GENERIC_SHOP "Generic"

#define GENERIC_ITEMS {"Health Amplee", "Health Potion", "Health Liquor",\
                       "Health Filler", "Soul Potion", "Soul Liquor",\
                       "Soul Filler", "Silver Bar", "White Gold Bar",\
                       "Elemental Jewel"}
#define NUM_GENERIC_ITEMS 10

#define MAX_INVENTORY_ITEM_QUANT 32767
#define INIT_ALLOC 2
#define START_VIS 1000000
#define STARTING_LEVEL 1
#define STARTING_EXPERIENCE 1
#define DEFAULT_START_LOC "Reboldeaux"
#define STARTING_WEAPON "Broad Sword"
#define STARTING_CHEST "Leather Tunic"
#define NOTHING_EQUIPPED "Empty"
#define MAX_CITY_CHARS 50
#define MAX_WEPARM_CHARS 50
#define MAX_GETWORD_BUFFER 250
#define MAX_MONSTER_NO 50
#define MAX_NPC_ACTIONS 10
#define MAX_DROPS_MONSTER 10
#define MAX_INVENTORY_ITEMS 255
#define MAX_UPGRADE_LEVEL 10
#define GUARANTEED_UPGRADE_LEVEL 4
#define BONUS_ATK_PER_UPG 5
#define BONUS_DEF_PER_UPG 5
#define ASCII_0 48
#define MAX_ENHANCEMENTS 3

#define LOADING_SCREEN "_____________________________________"
#define INVENTORY_SEPARATOR "============================================="
#define PLAYER_INFO_SEPARATOR "==============="
#define SEPARATOR "======================"
#define LINE_LIMIT 5
#define MAX_LVL 120
#define WEAPON "Weapon"
#define ARMOUR "Armour"
#define ITEM "Item"
#define LEGS "Legs"
#define HEADGEAR "Head Gear"
#define BOOTS "Boots"
#define GLOVES "Gloves"
#define LEVEL_OUTER_BOUND 10
#define LEVEL_INNER_BOUND 5
#define FALSE 0
#define TRUE 1
#define DELIM "~"
#define BOSS_PERCENT 10
#define ATTACK_MODIFIER 1.6
#define MAX_DAMAGE_REDUCTION .95
#define DADR_MODIFIER .25
#define LEVEL_1_HEALTH 1500
#define HP_PER_LVL 270
#define HEAL_PERCENT 10
#define DICE_COEFFICIENT_THRESHOLD 0.65
#define FILE_BUFFER_INSTANCES 350
#define HASH_TABLE_SIZE 500

typedef struct node node_t;
typedef struct slot slot_t;
typedef struct player player_t;
typedef struct world world_t;
typedef struct weapon weapon_t;
typedef struct armour armour_t;
typedef struct enchantment enchantment_t;
typedef struct item item_t;
typedef struct monster monster_t;
typedef struct inventory inventory_t;
typedef struct apparel apparel_t;
typedef struct combat_stats combat_stats_t;
typedef struct npc npc_t;
typedef struct npc_relationships npc_relationships_t;
typedef struct loot loot_t;
typedef struct hashtable hashtable_t;
typedef struct htable_bucket htable_bucket_t;
typedef char city_name_t[MAX_CITY_CHARS+1];
typedef char file_buffer_t[FILE_BUFFER_INSTANCES][MAX_GETWORD_BUFFER];

struct npc_relationships{
    int received_100_pioneer;
};
struct hashtable{
    htable_bucket_t* buckets;
    unsigned int table_size;
};

struct htable_bucket{
    int bucket_size;
    int bucket_limit;
    loot_t* loot;
};

struct loot{
    char* loot_name;
    int rarity;
};

struct monster{
    char* name;
    char native_to[MAX_MONSTER_NO+1][MAX_CITY_CHARS+1];
    int locations_inhabited;
    int level;
    int elite;
    int boss;
    int hp;
    unsigned int exp;
    int aspd;
    int hits_per_attack;
    int atk;
    int ar;
    int def;
    int dr;
    int fire_res;
    int ice_res;
    int lightning_res;
    int mental_res;

    int num_drops;
    int drops_alloc;
    char** drop_list;

    void (*print_monster)(monster_t *monster);
};

typedef struct{
    int level;
    unsigned int experience_till_next;
    unsigned int cum_experience;
}experience_vector_t;

typedef struct {
    char* name;
    city_name_t* edges;
    int city;
    int waypoint;
    int num_edges;
    int edge_alloclen;

    monster_t *monsters;
    int num_monsters;
    int monsters_alloclen;

    npc_t *npcs;
    int num_npcs;
    int npcs_alloclen;

}location_t;

struct slot{
    char* name;         // Name of item
    char* datatype;     // Type of item
    int quantity;
    void* item;         // The item
    slot_t* next;
};

struct node{
    location_t info;
    node_t* left;
    node_t* right;
};

struct world{
	node_t *parent;
	file_buffer_t waypoints;
	file_buffer_t menu_actions;
	int num_menu_actions;
	int num_waypoints;
	int num_locations;
	experience_vector_t *experience_table;

	weapon_t *weapons;
    int num_weapons;
    int allocated_weapons;

    armour_t *armours;
    int num_armour;
    int allocated_armour;

	item_t *items;
	int num_items;
	int allocated_items;

	monster_t *monsters;
	int num_monsters;
	int allocated_monsters;

	npc_t *npcs;
	int num_npcs;
	int allocated_npcs;

	hashtable_t *loot_table;


    void (*display_exp_table)(world_t *world);
    void (*location_edges)(world_t *world, char* location);
	void (*display_locations)(node_t *node);
	void (*display_weapons)(world_t *world);
	void (*display_armours)(world_t *world);
	void (*display_items)(world_t *world);
	void (*display_monsters)(world_t *world);
	void (*display_npcs)(world_t *world);
	void (*add_monster)(world_t *world, monster_t *monster, char* loc_name);
};


struct inventory{
    slot_t *first_slot;
    int num_objects;
    int num_weapons;
    int num_armour;
    int num_items;
    int value_inventory;

    void (*add)(inventory_t *inventory, char* name, char* datatype, int quantity, void* thing);
    void* (*remove)(inventory_t *inventory, char* name, char* datatype, int quantity);
    slot_t* (*find)(inventory_t *inventory, char* name);

};

struct item{
    char* name;
    char* datatype;
    char* type;
    int val;
    char* description;
};

struct enchantment{
    char* type;
    int val;
};

struct weapon{
    char* name;
    char* datatype;
    char* type;
    int level;
    int ar;
    int atk;
    int crit_chance;
    int val;
    int upgrade_level;
    int equipped;

    int num_enchantments;
    enchantment_t enchantments[MAX_ENHANCEMENTS];

    void (*print_weapon)(weapon_t *weapon);
};

struct armour{
    char* name;
    char* datatype;
    char* type;
    int level;
    int dr;
    int def;
    int evasion;
    int hp_bonus;
    int val;
    int upgrade_level;
    int equipped;

    int num_enchantments;
    enchantment_t enchantments[MAX_ENHANCEMENTS];

    void (*print_armour)(armour_t *armour);
};

struct apparel{
    char* weapon;
    weapon_t *equipped_weapon;

    char* gloves;
    armour_t *equipped_gloves;

    char* chest;
    armour_t *equipped_chest;

    char* boots;
    armour_t *equipped_boots;

    void(*print_apparel)(apparel_t *apparel);
};

struct combat_stats{
    int max_hp;
    int cur_hp;
    int ar;
    int atk;
    int crit_chance;
    int dr;
    int def;
    int evasion;
    int hp_bonus;
    int ardr_level_bonus;
};

struct player{
    char* name;
    char* location;
    int vis;
    int level;
    unsigned int experience;
    inventory_t inventory;
    apparel_t apparel;
    combat_stats_t combat_stats;
    npc_relationships_t *npc_relationships;

    void (*level_up)(world_t *world, player_t *self);
    void (*display_player_info)(player_t *player);
    void (*display_combat_stats)(player_t *player);
    void (*display_inventory)(inventory_t *inventory);
    void (*display_apparel)(player_t *player);
    void (*enter_locn)(world_t *world, player_t *player, char* location);
    void (*equip)(player_t *player, char* datatype, void* thing);
    void (*unequip)(player_t *player, char* name);
};

struct npc{
    char* name;            // Name of npc
    char* shop_type;       // Type of merchandise they sell (if any)

    int level;              // Beginning level of weps/armour they sell (if any)

    char* merchandise_type;     // Type of Merchandise, eg Polearm

    char actions[MAX_NPC_ACTIONS][MAX_CITY_CHARS+1];
    int num_actions;


    char* dialogue;        // Generic chat dialogue for npc
    int num_dialogue;
    int alloc_dialogue;

};

int
getword(char W[], int limit);
char* mystrcasestr(char *txt, char *pat);
int hamming_distance(char* str1, char* str2);
double dice_coefficient(char* str1, char* str2, int n);
static int is_elite(char* str);
static int is_vowel(char ch);



/*Game State Related Functions */
void play(world_t *world, player_t *player);
int action_menu(world_t *world, player_t *player);
void action_exit_location(world_t *world, player_t *player);
void action_waypoint(world_t *world, player_t *player);
void action_modify_apparel(world_t *world, player_t *player);
void action_wander_around(world_t *world, player_t *player);

void* clone_object(void* src, size_t src_size);
void afk_farm(world_t *world, player_t *player, int n);
void add_vis(player_t *player, int add_to_player);
int vis_subtract(player_t *player, int subtract_from_player);

void save_file(player_t *player, char file_to_save[MAX_CITY_CHARS+1]);
void load_file(world_t *world, player_t *player, char* file_name);
unsigned int hash_of_save();
void loading_screen(world_t* world, player_t* player, char file_loaded[MAX_CITY_CHARS+1]);
void print_save_files(void);

/* NPCS Interaction Functions */
void desired_action_npc(world_t *world, player_t *player);
int input_npc_user(char A[][MAX_CITY_CHARS+1], int n, char name[MAX_CITY_CHARS+1]);

void buy_objects(world_t *world, npc_t *npc, player_t *player);
void sell_objects(npc_t *npc, player_t *player);
static void bought_something_msg(char* name, char* bought, int val, int quantity, char* datatype);
static void sold_something_msg(char*name, char* sold, int val, int quantity, char* datatype);

void action_research_monster(world_t *world, npc_t *npc, player_t *player);

void action_upgrade_weparm(npc_t *npc, player_t *player);

static int can_upgrade_weparm(int curr_upgrade_level, char* name, char *datatype, char *type);
static int proceed_with_upgrade(npc_t *npc, int curr_upgrade_level, char* name);
static int upgrade_successful(int curr_upgrade_level);

void action_enchant_weparm(npc_t *npc, player_t *player);
static slot_t* can_enchant_weparm(char A[][MAX_WEPARM_CHARS+1], inventory_t* inventory, int weparm_level, char* name);
void enchant(player_t *player, slot_t *object, slot_t *chip);
void reset_enchantments(slot_t *object);
static int use_item(inventory_t* inventory, slot_t* slot, int quant);

void rock_paper_scissors(npc_t *npc, player_t *player);
static void rock_paper_scissors_outcome_msg(npc_t *npc, char* p_choice, char* c_choice, int bet, int outcome);

/* Dictionary Related Functions */
void create_hashtable(hashtable_t *table, unsigned int table_size);
void dict_add(hashtable_t *table, char* key, int rarity);
loot_t* create_empty_loot(void);
loot_t* dict_search(hashtable_t *table, char* key);
void print_dict(hashtable_t *table);
unsigned int ELFHash(const char* str, unsigned int length);
void free_dict(hashtable_t *table);

/* Combat Related Functions */
static monster_t* encounter_monster(world_t *world, player_t *player);
static int battle_monster(player_t *player, monster_t *monster);
static int player_damage_calc(player_t *player, monster_t *monster);
static int monster_damage_calc(player_t *player, monster_t *monster);
static void restore_health(player_t *player, int health);
static unsigned int exp_from_kill(player_t *player, monster_t *monster);
static void level_up (world_t *world, player_t *player);
void loot_dead_monster(world_t *world, player_t *player, monster_t *monster);

/* File Related Functions */
int read_file(FILE *fp, char buff[][MAX_GETWORD_BUFFER]);
void load_in_assets(world_t *world);
void load_in_locations(world_t *world, file_buffer_t locations);
void add_location(world_t *world, char* loc_name);
void add_edge(world_t *world, char* src, char* dest);
void load_in_weapons(world_t *world, file_buffer_t weapons, char* delim);
void load_in_armour(world_t *world, file_buffer_t armours, char* delim);
void load_in_waypoints(world_t *world);
void load_in_exptable(world_t *world, char experiences[MAX_LVL][MAX_GETWORD_BUFFER]);
void load_in_items(world_t *world, file_buffer_t items, char* delim);
void load_in_monsters(world_t *world, file_buffer_t monsters, char* delim);
void load_in_cities(world_t *world, file_buffer_t cities, int n);
void load_in_npcs(world_t *world, file_buffer_t npcs, char* delim);
void load_in_loot_table(world_t* world, file_buffer_t loot, int n, char* delim);

/* Node/Tree Related Functions */
node_t* insert_tree(node_t *parent, node_t *new_node);
node_t* find_node(node_t *parent, char* node_name);
int len_tree(node_t *root);
void free_locations(node_t *node);

/* World Related Functions */
void create_world(world_t *world);
static void print_locations(node_t *node);
static void print_location_edges(world_t *world, char* location);
static void print_levels_table(world_t *world);
static void print_monsters(world_t *world);
static void print_games_weapons(world_t *world);
static void print_games_armour(world_t *world);
static void print_games_items(world_t *world);
static void print_games_npcs(world_t *world);
static void add_monster_to_location(world_t *world, monster_t *monster, char* loc_name);
void free_world(world_t *world);

/* Player Related Functions */
void create_player(player_t *player);
static void print_player_info(player_t *player);
static void enter_location(world_t *world, player_t *player, char* location);
static void display_combat_stats(player_t *player);
void new_player(world_t *world, player_t *player);
static void display_apparel(player_t *player);
void equip(player_t *player, char* datatype, void* thing);
void unequip(player_t *player, char* name);
void free_player(player_t *player);

/* Weapon Related Functions */
void create_weapon(weapon_t *weapon, char* name, char* type, int level, int ar,
              int atk, int val);
static void print_weapon(weapon_t *weapon);
weapon_t* find_weapon(world_t *world, char* weapon_name);
void free_weapon(weapon_t *weapon);


/* Armour Related Functions */
void create_armour(armour_t *armour, char* name, char* type, int level, int dr,
              int def, int val);
static void print_armour(armour_t *armour);
armour_t* find_armour(world_t *world, char* armour_name);
void free_armour(armour_t *armour);

/* Combat Stats Related Functions */
void create_combat_stats (combat_stats_t *combat_stats);
static void print_combat_stats(combat_stats_t *combat_stats);

/* Item Related Functions */
void create_item (item_t *item, char* name, char* type, int val, char* description);
void print_item(item_t *item);
item_t* find_item(world_t *world, char* item_name);
void free_item(item_t *item);

/* Inventory Related Functions */
void create_inventory(inventory_t *inventory);
void add_to_inventory(inventory_t *inventory, char* name, char* type, int quantity, void* thing);
static void print_inventory(inventory_t *inventory);
void* remove_from_inventory(inventory_t *inventory, char* name, char* datatype, int quantity);
slot_t* find_from_inventory(inventory_t *inventory, char* name);
void increase_item_quantity(inventory_t *inventory, char* name, int quant);
int inventory_to_array(inventory_t *inventory, char A[][MAX_CITY_CHARS+1]);
void free_inventory(inventory_t *inventory);

/* Apparel Related Functions */
void create_apparel(apparel_t *apparel);
static void print_apparel(apparel_t *apparel);
void free_apparel(apparel_t *apparel);

/* Monster Related Functions */
void create_monster(monster_t *monster, char* name, char habitat[][MAX_CITY_CHARS+1],
                    int num_habitat, int level, int hp, unsigned int exp, int aspd,
               int hits_per_attack, int atk, int ar, int def, int dr,
               int fire_res, int ice_res, int lightning_res, int mental_res,
               char loot_drops[][MAX_WEPARM_CHARS+1], int n);
static void print_monster(monster_t *monster);
void free_monster(monster_t *monster);

/* NPC Related Fuctions */
void create_npc(npc_t *npc, char* name, char* shop_type, char* merchandise_type,
           char actions[][MAX_CITY_CHARS+1], int num_actions);
void print_npc(npc_t *npc);
void free_npc(npc_t *npc);

void
load_in_assets(world_t *world){
    int fnum;
    /* File Contents */
    file_buffer_t locations;
    file_buffer_t weapons;
    file_buffer_t armours;
    char experiences[MAX_LVL][MAX_GETWORD_BUFFER];
    file_buffer_t items;
    file_buffer_t monsters;
    file_buffer_t cities;
    file_buffer_t npcs;
    file_buffer_t loot;
    int num_cities;
    int n; // Number of loot in dictionary
	FILE *fp;
	char* file[] = FILES;

	/* Process game information from files in command line arguments */
	for (fnum=0; fnum<NUM_FILES; fnum++) {
		fprintf(stderr, "Opening: %s\n", file[fnum]);
		if ((fp = fopen(file[fnum], "r")) == NULL) {
			fprintf(stderr, "............failed\n");
		}
		/* fnum+1 since this was originally designed to take arguments from the command line */
		switch(fnum){
			case 0: world->num_locations = read_file(fp, locations);
                load_in_locations(world, locations);
                break;

            case 1: world->num_weapons = read_file(fp, weapons);
                load_in_weapons(world, weapons, DELIM);
                break;

            case 2: world->num_armour = read_file(fp, armours);
                load_in_armour(world, armours, DELIM);
                break;

            case 3: world->num_waypoints = read_file(fp, world->waypoints);
                load_in_waypoints(world);
                break;
            case 4: world->num_items = read_file(fp, items);
                load_in_items(world, items, DELIM);
                break;

            case 5: read_file(fp, experiences);
                load_in_exptable(world, experiences);
                break;

            case 6: world->num_monsters = read_file(fp, monsters);
                assert(world->parent != NULL);
                load_in_monsters(world, monsters, DELIM);
                break;

            case 7: world->num_menu_actions = read_file(fp, world->menu_actions);
                // Being lazy and just treating the buffer as the list
                break;

            case 8: num_cities = read_file(fp, cities);
                assert(world->parent != NULL);
                load_in_cities(world, cities, num_cities);
                break;

            case 9: world->num_npcs = read_file(fp, npcs);
                assert(world->parent != NULL);
                load_in_npcs(world, npcs, DELIM);
                break;

            case 10: n = read_file(fp, loot);
                load_in_loot_table(world, loot, n, DELIM);
                break;
		default: ;
            printf("Fnum: %d\n", fnum);
            printf("File Name: %s\n", file[fnum]);
            fprintf(stderr, "Too many arguments -- Check text file new lines\n");
		}
	}

}
int
main(int argc, char* argv[]){
    world_t world;
    create_world(&world);
    time_t now = time(NULL);
    srand(now ^ (getpid()<<16));
    load_in_assets(&world);


    char file_loaded[MAX_CITY_CHARS+1];
    player_t player;
    create_player(&player);
    loading_screen(&world, &player, file_loaded);


    play(&world, &player);
    save_file(&player, file_loaded);
    printf("Attempting to Free\n");
    free_world(&world);
    printf("Successfully Freed\n");


}

void
print_save_files(void){
    char save_files[MAX_NUM_SAVEFILES][MAX_CITY_CHARS+1] = S_FILES;
    int i;
    printf("\tName\tVis\n");
    for(i=0; i<MAX_NUM_SAVEFILES; i++){
        FILE* save = fopen(save_files[i], "r");
        if (save != NULL){
            file_buffer_t file;
            read_file(save, file);
            printf("(%d) %10s", i, file[0]);
            printf("\t%d\n", atoi(file[1]));
        }
        fclose(save);

    }
}
void
loading_screen(world_t* world, player_t *player, char file_loaded[MAX_CITY_CHARS+1]){
    printf("%s%s\n", LOADING_SCREEN, LOADING_SCREEN);
    printf("\n");
    printf("Welcome. This is a text-based game and is a loose port of Granado Espada.\n");
    printf("\n");
    menu: ;
    printf("\t%s== Menu ==%s\n", SEPARATOR, SEPARATOR);
    printf("\tPlay Game\t\t About\t\tTamper Repair\n");
    printf("\n");

    printf("\tWhich option would you like to select? ");

    char options[][MAX_CITY_CHARS+1] = {"Play Game", "About", "Tamper Repair"};
    char input[MAX_CITY_CHARS+1];
    int op = -1;
    /* Get Player Choice */
    while (op == -1){
        op = input_npc_user(options, 3, input);
        if (op == -1){
            printf("\n\tYou entered: %s which is not a recognised option. Try again\n", input);
            printf("\tWhich option would you like to select? ");
            Sleep(1500);
        }
    }
    switch(op){
        case 0: ;
            FILE* save = fopen(SAVE_FILE, "r");
            if (save != NULL){
                load_file(world, player, SAVE_FILE);
            }
            else {
                printf("No save file detected. If you do have a savefile, please ensure it is named %s\n", SAVE_FILE);
                new_player(world, player);
            }
            break;
        case 1: ;
            printf("ROFLMFAO\n");
            goto menu;
            break;
        case 2: ;
            printf("\n\n");
            printf("If you open the save file, after the line which has 'end',"
                   " there is a number. This number hashes information about "
                   "your player when you last saved your game. If you "
                   "tampered with the save file, short of a colission, the "
                   "hash will not match, hence the error. Your save file will "
                   "be rehashed as it currently is. Simply replace this new "
                   "hash number with the old one and the game should load as "
                   "normal. If it does not, it means the game may be corrupted"
                   ". If that is the case, you're on your own!\n\n");

            printf("Hash: %u (replace with this after 'end', DO NOT leave a new line)\n\n\n", hash_of_save());
            printf("%s%s\n\n", LOADING_SCREEN, LOADING_SCREEN);
            printf("Program Terminating.\n");
            exit(EXIT_SUCCESS);
        default:
            printf("Catastrophic Error.\n");
            exit(EXIT_FAILURE);
    }
    strcpy(file_loaded, SAVE_FILE);
    printf("%s%s\n\n", LOADING_SCREEN, LOADING_SCREEN);

}
void load_file(world_t *world, player_t *player, char* file_name){
    FILE *l_file;
    l_file = fopen(file_name, "r");
    if (l_file == NULL){
        /* No File to Load */
        return;
    }
    file_buffer_t buffer;
    int n = read_file(l_file, buffer);
    if (atoi(buffer[n]) != hash_of_save()){
        printf("You have tampered with the file!\n");
        printf("Program Terminating.");
        exit(EXIT_SUCCESS);
    }
    else{
        printf("Loaded in\n");
    }
    player->name = malloc(sizeof(char)*(strlen(buffer[0] + 1)));
    strcpy(player->name, buffer[0]);
    player->vis = atoi(buffer[1]);
    player->experience = atoi(buffer[2]);
    player->level_up(world, player);
    strcpy(player->location, buffer[3]);

    int i = 10;
    /* Loads Inventory into Player from Save File */
    for (;;){
        if (i >= n){
            return;
        }
        if (memcmp(buffer[i], INVENTORY_SEPARATOR, strlen(INVENTORY_SEPARATOR)) == 0){
            break;
        }
        if (memcmp(buffer[i], SEPARATOR, strlen(SEPARATOR)) == 0){
            i++;
            continue;
        }

        if (strcmp(buffer[i+1], ITEM) == 0){
            item_t *item_temp = find_item(world, buffer[i]);
            player->inventory.add(&player->inventory, item_temp->name, item_temp->datatype, atoi(buffer[i+2]), clone_object(item_temp, sizeof(*item_temp)));
            i += 2;
        }

        else if (strcmp(buffer[i+1], WEAPON) == 0){
            weapon_t *wep_temp = find_weapon(world, buffer[i]);
            player->inventory.add(&player->inventory, wep_temp->name, wep_temp->datatype, atoi(buffer[i+2]), clone_object(wep_temp, sizeof(*wep_temp)));
            i+=3;
            if (strcmp(buffer[i], SEPARATOR)){
                slot_t* slot = player->inventory.find(&player->inventory, wep_temp->name);
                assert(strcmp(slot->datatype, WEAPON) == 0);
                ((weapon_t*)slot->item)->upgrade_level = atoi(buffer[i]);
                ((weapon_t*)slot->item)->num_enchantments = atoi(buffer[i+1]);
                if (atoi(buffer[i+1]) > 0){
                    int j;
                    for(j=0; j<atoi(buffer[i+1]); j++){
                        char* token = strtok(buffer[i+2+j], DELIM);
                        ((weapon_t*)slot->item)->enchantments[j].type = malloc(sizeof(char)*(strlen(token)+1));
                        assert(((weapon_t*)slot->item)->enchantments[j].type != NULL);
                        strcpy(((weapon_t*)slot->item)->enchantments[j].type, token);
                        token = strtok(NULL, DELIM);

                        ((weapon_t*)slot->item)->enchantments[j].val = atoi(token);
                    }

                }

                i++;
            }
        }
        else if (strcmp(buffer[i+1], ARMOUR) == 0){

            armour_t *arm_temp = find_armour(world, buffer[i]);

            assert(arm_temp != NULL);
            player->inventory.add(&player->inventory, arm_temp->name, arm_temp->datatype, atoi(buffer[i+2]), clone_object(arm_temp, sizeof(*arm_temp)));
            i+=3;

            if (strcmp(buffer[i], SEPARATOR)){
                slot_t* slot = player->inventory.find(&player->inventory, arm_temp->name);
                assert(strcmp(slot->datatype, ARMOUR) == 0);
                ((armour_t*)slot->item)->upgrade_level = atoi(buffer[i]);
                ((armour_t*)slot->item)->num_enchantments = atoi(buffer[i+1]);
                if (atoi(buffer[i+1]) > 0){
                    int j;
                    for(j=0; j<atoi(buffer[i+1]); j++){
                        char* token = strtok(buffer[i+2+j], DELIM);
                        ((armour_t*)slot->item)->enchantments[j].type = malloc(sizeof(char)*(strlen(token)+1));
                        assert(((armour_t*)slot->item)->enchantments[j].type != NULL);
                        strcpy(((armour_t*)slot->item)->enchantments[j].type, token);
                        token = strtok(NULL, DELIM);

                        ((armour_t*)slot->item)->enchantments[j].val = atoi(token);
                    }

                }

                i++;
            }
        }
        if (i>=n){
            return;
        }
        i++;

    }
    assert(memcmp(buffer[i], INVENTORY_SEPARATOR, strlen(INVENTORY_SEPARATOR)) == 0);
    i++;
    /* Load Apparel into Player from Save File */
    for (;;){
        if (i >= n){
            return;
        }


        while(i < n || atoi(buffer[i]) == 12345){
            char* token;

            token = strtok(buffer[i], DELIM);
            if (strcmp(token, WEAPON) == 0){
                token = strtok(NULL, DELIM);
                if (strcmp(token, NOTHING_EQUIPPED) == 0){
                    ;
                }
                else{
                    weapon_t* wep_temp = find_weapon(world, token);
                    assert(wep_temp != NULL);
                    void* wep = clone_object(wep_temp, sizeof(*wep_temp));
                    /* Upgrade Level */
                    if (atoi(buffer[i+1]) > 0){
                        ((armour_t*)wep)->upgrade_level = atoi(buffer[i+1]);
                    }
                    /* Num Enchantments */
                    if (atoi(buffer[i+2]) > 0){
                        ((weapon_t*)wep)->num_enchantments = atoi(buffer[i+2]);
                        int j;
                        /* Enchantments */
                        for(j=0; j<((weapon_t*)wep)->num_enchantments; j++){
                            char* token = strtok(buffer[i+3+j], DELIM);

                            ((weapon_t*)wep)->enchantments[j].type = malloc(sizeof(char)*(strlen(token)+1));
                            assert(((weapon_t*)wep)->enchantments[j].type != NULL);
                            strcpy(((weapon_t*)wep)->enchantments[j].type, token);
                            token = strtok(NULL, DELIM);
                            ((weapon_t*)wep)->enchantments[j].val = atoi(token);

                        }
                    }
                    /* Equip weapon, unless it is too high level, then place it in inventory */
                    if (wep_temp->level <= player->level){
                        player->inventory.add(&player->inventory, wep_temp->name, wep_temp->datatype, 1, wep);
                        player->equip(player, wep_temp->datatype, wep);
                    }
                    else{
                        fprintf(stderr, "I think you have tampered with the save file! Placing %s into your inventory instead!\n", wep_temp->name);
                        strcpy(player->apparel.weapon, NOTHING_EQUIPPED);
                    }
                }
            }
            else if (strcmp(token, CHEST) == 0
                     || strcmp(token, GLOVES) == 0
                     || strcmp(token, BOOTS) == 0){
                token = strtok(NULL, DELIM);
                if (strcmp(token, NOTHING_EQUIPPED) == 0){
                    ;
                }
                else{
                    armour_t* arm_temp = find_armour(world, token);
                    assert(arm_temp != NULL);
                    void* arm = clone_object(arm_temp, sizeof(*arm_temp));
                    if (atoi(buffer[i+1]) > 0){
                        ((armour_t*)arm)->upgrade_level = atoi(buffer[i+1]);
                    }
                    if (atoi(buffer[i+2]) > 0){
                        ((armour_t*)arm)->num_enchantments = atoi(buffer[i+2]);
                        int j;
                        for(j=0; j<((armour_t*)arm)->num_enchantments; j++){
                            char* token = strtok(buffer[i+3+j], DELIM);
                            ((armour_t*)arm)->enchantments[j].type = malloc(sizeof(char)*(strlen(token)+1));
                            assert(((armour_t*)arm)->enchantments[j].type != NULL);
                            strcpy(((armour_t*)arm)->enchantments[j].type, token);
                            token = strtok(NULL, DELIM);
                            ((armour_t*)arm)->enchantments[j].val = atoi(token);

                        }
                    }

                    if (arm_temp->level <= player->level){
                        player->inventory.add(&player->inventory, arm_temp->name, arm_temp->datatype, 1, arm);
                        player->equip(player, arm_temp->datatype, arm);
                    }

                    else{
                        fprintf(stderr, "I think you have tampered with the save file! Placing %s into your inventory instead!\n", arm_temp->name);
                        printf("Type :%s\n", arm_temp->type);
                        player->inventory.add(&player->inventory, arm_temp->name, arm_temp->datatype, 1, arm);
                        if (strcmp(arm_temp->type, CHEST) == 0){
                            strcpy(player->apparel.chest, NOTHING_EQUIPPED);
                        }
                        else if(strcmp(arm_temp->type, GLOVES) == 0){
                            strcpy(player->apparel.gloves, NOTHING_EQUIPPED);
                        }
                        else if(strcmp(arm_temp->type, BOOTS) == 0){
                            strcpy(player->apparel.boots, NOTHING_EQUIPPED);
                        }
                    }
                }
            }
            i++;
        }
        i++;
    }



}
void save_file(player_t *player, char file_to_save[MAX_CITY_CHARS+1]){
    FILE * s_file;

    s_file = fopen(file_to_save, "w");
    if(s_file == NULL){
        /* File not created hence exit */
        printf("Unable to create file.\n");
        exit(EXIT_FAILURE);
    }
    fprintf(s_file, "%s\n%d\n%u\n%s\n", player->name, player->vis, player->experience, player->location);
    fprintf(s_file,"%s Inventory %s\n", INVENTORY_SEPARATOR, INVENTORY_SEPARATOR);
    fprintf(s_file,"%d\n%d\n%d\n%d\n%d\n", player->inventory.num_objects,
                                         player->inventory.num_weapons,
                                         player->inventory.num_armour,
                                         player->inventory.num_items,
                                         player->inventory.value_inventory);
    slot_t* curr = player->inventory.first_slot;
    int i;
    while(curr != NULL){
        fprintf(s_file, "%s\n%s\n%s\n%d\n", SEPARATOR, curr->name, curr->datatype, curr->quantity);
        if (strcmp(curr->datatype, WEAPON) == 0){
            weapon_t* temp = ((weapon_t*)curr->item);
            fprintf(s_file, "%d\n%d\n", temp->upgrade_level, temp->num_enchantments);
            for(i=0; i<temp->num_enchantments; i++){
                fprintf(s_file, "%s~%d\n", temp->enchantments[i].type, temp->enchantments[i].val);
            }
        }
        else if (strcmp(curr->datatype, ARMOUR) == 0){
            armour_t* temp = ((armour_t*)curr->item);
            fprintf(s_file, "%d\n%d\n", temp->upgrade_level, temp->num_enchantments);
            for(i=0; i<temp->num_enchantments; i++){
                fprintf(s_file, "%s~%d\n", temp->enchantments[i].type, temp->enchantments[i].val);
            }
        }
        curr = curr->next;
    }
    fprintf(s_file,"%s Apparel %s\n", INVENTORY_SEPARATOR, INVENTORY_SEPARATOR);
    fprintf(s_file,"Weapon~%s\n", player->apparel.weapon);
    if (strcmp(player->apparel.weapon, NOTHING_EQUIPPED) != 0){
        fprintf(s_file, "%d\n%d\n", player->apparel.equipped_weapon->upgrade_level,
                                  player->apparel.equipped_weapon->num_enchantments);
        if(player->apparel.equipped_weapon->num_enchantments>0){
            int j;
            for(j=0; j<player->apparel.equipped_weapon->num_enchantments; j++){
                fprintf(s_file, "%s~%d\n", player->apparel.equipped_weapon->enchantments[j].type,
                                   player->apparel.equipped_weapon->enchantments[j].val);
            }
        }
    }

    fprintf(s_file,"%s\n", SEPARATOR);
    fprintf(s_file,"Chest~%s\n", player->apparel.chest);
    if (strcmp(player->apparel.chest, NOTHING_EQUIPPED) != 0){
        fprintf(s_file, "%d\n%d\n", player->apparel.equipped_chest->upgrade_level,
                                  player->apparel.equipped_chest->num_enchantments);

        if (player->apparel.equipped_chest->num_enchantments>0){
            int j;
            for(j=0; j<player->apparel.equipped_chest->num_enchantments; j++){
                fprintf(s_file, "%s~%d\n", player->apparel.equipped_chest->enchantments[j].type,
                                   player->apparel.equipped_chest->enchantments[j].val);
            }
        }
    }

    fprintf(s_file, "%s\n", SEPARATOR);
    fprintf(s_file,"Gloves~%s\n", player->apparel.gloves);
    fprintf(s_file, "%s\n", SEPARATOR);
    fprintf(s_file,"Boots~%s\n", player->apparel.boots);
    fprintf(s_file, "%s\n", SEPARATOR);
    fprintf(s_file, "end\n");
    fclose(s_file);
    s_file = fopen(SAVE_FILE, "a");

    fprintf(s_file, "%u", hash_of_save());
    fclose(s_file);
}
unsigned int
hash_of_save(void){

    FILE* s_file = fopen(SAVE_FILE, "r");
    file_buffer_t buffer;
    printf("Opening: %s\n", SAVE_FILE);
    int num_lines = read_file(s_file, buffer);

    fclose(s_file);
    s_file = fopen(SAVE_FILE, "r");

    if(s_file == NULL){
        /* File not created hence exit */
        printf("Unable to create file.\n");
        exit(EXIT_FAILURE);
    }
    int alloc = 500;
    char* file = malloc(sizeof(*file) * alloc);
    file[0] = '\0';

    int c;
    int lines = 0;
    int i = 0;

    rewind(s_file);

    while((c = getc(s_file)) != EOF){
        if (i==alloc){
            alloc *= 2;
            file = realloc(file, alloc);
        }
        if(c == '\n'){
            lines++;
            if (lines == num_lines){
                break;
            }
            continue;
        }
        file[i++] = c;
    }
    file[i] = '\0';
    fclose(s_file);

    unsigned int hash = ELFHash(file, (unsigned int)(strlen(file)));
    return hash<<16;
}

/* Loads game information file into an array and returns number of lines read */
int
read_file(FILE *fp, char buff[][MAX_GETWORD_BUFFER]) {
	int c;          // Character read in
	int lines=0;    // Lines of file
	int i = 0;      // Characters per line
	while ((c = getc(fp)) != EOF) {
        if (i >= MAX_GETWORD_BUFFER){
            fprintf(stderr, "Line: %d exceeds the getword buffer of %d\n", lines, MAX_GETWORD_BUFFER);
            exit(EXIT_FAILURE);
        }
        buff[lines][i++] = c;
        /* Add null byte to close string for line */
        if (c == '\n') {
            buff[lines++][i-1] = '\0';
            i = 0;
        }
	}

	fclose(fp); // File was opened in main
    //fprintf(stderr, "\tFile read and closed successfully: %d lines read\n", lines);
	return lines;
}

void
play(world_t *world, player_t *player){
    printf("Welcome Back %s!\n", player->name);
    for(;;){
        if (action_menu(world, player) == 0){
            break;
        }
    }
}

/* Menu for actions player can undertake when in a location */

void
action_exit_location(world_t *world, player_t *player){
    node_t *temp = find_node(world->parent, player->location);
    int i;
    int option = -1;
    char options[temp->info.num_edges][MAX_CITY_CHARS+1];
    printf("Where would you like to go?\n");

    for (i=0; i<temp->info.num_edges; i++){
        strcpy(options[i], temp->info.edges[i]);
        printf("\t%s\n", temp->info.edges[i]);
    }

    char input[MAX_CITY_CHARS+1];
    while(option == -1){
        option = input_npc_user(options, world->num_waypoints, input);
        if (option == -1){
            printf("\nYou entered: %s which is not a recognised location. Try again: ", input);
            Sleep(1200);
        }
    }

    player->enter_locn(world, player, temp->info.edges[option]);
}

void
action_waypoint(world_t *world, player_t *player){
    node_t *temp = find_node(world->parent, player->location);
    assert(temp->info.waypoint && "No waypoint in this location");

    int option = -1;
    int i;

    char options[world->num_waypoints][MAX_CITY_CHARS+1];
    printf("Where would you like to teleport to?\n");
    for (i=0; i<world->num_waypoints; i++){
        strcpy(options[i], world->waypoints[i]);
        printf("\t%s\n", world->waypoints[i]);
    }
    char input[MAX_CITY_CHARS+1];
    printf("Hello\n");

    while(option == -1){
        option = input_npc_user(options, world->num_waypoints, input);
        if (option == -1){
            printf("\nYou entered: %s which is not a recognised location. Try again: ", input);
            Sleep(1200);
        }
    }
    printf("Option: %d\n", option);
    temp = find_node(world->parent, world->waypoints[option]);
    assert(temp != NULL);
    player->enter_locn(world, player, temp->info.name);

}

void
rock_paper_scissors(npc_t *npc, player_t *player){
    printf("%s: How much Vis do you want to bet me? 50:50 odds (Type in a number).\n", npc->name);
    int bet = 1;
    fscanf(stdin, " %d", &bet);
    if (player->vis < bet){
        printf("%s: You tried to scam me, you don't have %d Vis.\n", npc->name, bet); Sleep (1800);
        printf("\t%s kicks you in the groin. Repeateadly, and spits on your face.\n", npc->name);
        printf("\t%s takes all the vis you had: %d Vis, you now have 0 Vis.\n", npc->name, player->vis); Sleep(4000);
        printf("%s: You are no better than the fools who borrow money to buy bitcoin, "
               "your greed and dishonesty have been punished.\n", npc->name); Sleep(3000);
        printf("\nYour injuries are so severe you have been taken back to %s to heal.\n", DEFAULT_START_LOC); Sleep(1800);
        player->vis = 0;
        strcpy(player->location, DEFAULT_START_LOC);
        return;
    }
    printf("%s: Alright %d Vis, standard rules (Type your selection).\n", npc->name, bet);

    int outcome = -1; // Outcome of Bet
    do {
        char options[][MAX_CITY_CHARS+1] = {"Rock", "Paper", "Scissors"};
        char input[MAX_CITY_CHARS+1];
        int op = -1;
        /* Get Player Choice */
        while (op == -1){
            printf("\tRock\n");
            Sleep(300);
            printf("\tPaper\n");
            Sleep(300);
            printf("\tScissors\n");
            Sleep(300);
            printf("Type your selection: ");
            op = input_npc_user(options, 3, input);
            if (op == -1){
                printf("You entered: %s; What is that? Are you trying to scam me? Go again.", input);
                Sleep(1500);
            }
        }

        /* Get Computer Choice */
        int computer_choice = (rand()%100);
        int rock = 34;
        int scissors = 68;
        char pc_choice[9];

        if (computer_choice <= 34){
            strcpy(pc_choice, "Rock");
        }
        else if (computer_choice >= 68){
            strcpy(pc_choice, "Scissors");
        }
        else{
            strcpy(pc_choice, "Paper");
        }
        /* Rock is 0-34, Paper is 35-67, Scissors is 68-100 -- Paper to Win! */

        /* Get Outcome */
        /* Chose Paper */
        if (op == 1){
            /* Computer Chooses Rock */
            if (computer_choice <= rock){
                outcome = 1;    // Player Wins
            }
            /* Computer Choosees Scissors */
            else if (computer_choice >= scissors){
                outcome = 0;    // Player Loses
            }
            /* Computer Chooses Paper */
            else{
                outcome = -1;   // Draw
            }
        }
        /* Chose Rock */
        else if (op == 0){
            if (computer_choice <= rock){
                outcome = -1;
            }
            else if (computer_choice >= scissors){
                outcome = 1;
            }
            else{
                outcome = 0;
            }
        }
        /* Chose Scissors */
        else if (op == 2){
            if (computer_choice <= rock){
                outcome = 0;
            }
            else if (computer_choice >= scissors){
                outcome = -1;
            }
            else{
                outcome = 1;
            }
        }
        if (outcome == -2){
            printf("User Choice: %s, Computer Choice: %s\n", options[op], pc_choice);
            assert(0 && "Rock Paper Scissors Error");
        }
        rock_paper_scissors_outcome_msg(npc, options[op], pc_choice, bet, outcome);
    } while(outcome == -1);

    /* Add Vis Player won, checking for overflow */
    if (outcome == 1){
        if (player->vis + bet < player->vis){
            player->vis = INT_MAX;
        }
        else{
            player->vis += bet;
        }
    }
    /* Subtract Vis Player won (cannot be negative since checked above */
    else if (outcome == 0){
        player->vis -= bet;
    }

    printf("%s: Do you want to play again? (Y/N) ", npc->name);
    char again[2];
    getword(again, 2);
    if (tolower(again[0]) == 'y'){
        Sleep(500);
        rock_paper_scissors(npc, player);
    }
}

static void
rock_paper_scissors_outcome_msg(npc_t *npc, char* p_choice, char* c_choice, int bet, int outcome){
    if (outcome == 0){
        printf("%s: You picked %s and I picked %s, looks like you lost %d Vis, typical.\n", npc->name, p_choice, c_choice, bet);
    }
    else if (outcome == 1){
        printf("%s: You picked %s and I picked %s, looks like you won %d Vis, nice luck.\n", npc->name, p_choice, c_choice, bet);
    }
    else if (outcome == -1){
        printf("%s: You picked %s and I picked %s, a draw. Go again.\n", npc->name, p_choice, c_choice);
    }
}

void
add_vis(player_t *player, int add_to_player){
    if (player->vis + add_to_player < player->vis){
        player->vis = INT_MAX;
    }
    else{
        player->vis += add_to_player;
    }
}

int
vis_subtract(player_t *player, int subtract_from_player){
    if (player->vis - subtract_from_player < 0){
        return 0;
    }
    else{
        player->vis -= subtract_from_player;
        return 1;
    }
}

static int
is_elite(char* str){
    char temp[] = "Elite";
    return memcmp(str, temp, sizeof(char)*((int)strlen(temp))) == 0;
}

/* Returns 1 if char is vowel, and 0 if not */
static int
is_vowel(char ch){
    ch = tolower(ch);
    return ch == 'a' || ch == 'e' || ch == 'i' || ch == 'o' || ch == 'u';
}

/* Prints message to stdout if player sells something to NPC */
static void
sold_something_msg(char*name, char* sold, int val, int quantity, char* datatype){
    if (quantity == 0){
        printf("You sold nothing!\n");
        return;
    }
    if (strcmp(datatype, WEAPON) == 0
        || strcmp(datatype, ARMOUR) == 0){
        printf("%s: You sold a", name);
        if (is_vowel(sold[0])){
            printf("n %s for %d\n", sold, val);
        }
        else{
            printf(" %s for %d Vis!\n", sold, val);
        }
    }
    else if (strcmp(datatype, ITEM) == 0){
        printf("%s: You sold %d %s", name, quantity, sold);
        if (quantity > 1){
            printf("'s for %d Vis!\n", quantity*val);
        }
        else if (quantity == 1){
            printf(" for %d Vis!\n", val);
        }
    }

}

/* Prints message to stdout if player buys something from NPC */
static void
bought_something_msg(char* name, char* bought, int val, int quantity, char* datatype){
    if (quantity == 0){
        printf("You bought nothing!\n");
        return;
    }
    if (strcmp(datatype, WEAPON) == 0
        || strcmp(datatype, ARMOUR) == 0){

        printf("%s: You bought a", name);
        if (is_vowel(bought[0])){
            printf("n %s for %d Vis!\n", bought, val);
        }
        else{
            printf(" %s for %d Vis!\n", bought, val);
        }
    }
    else if (strcmp(datatype, ITEM) == 0){
        printf("%s: You bought %d %s", name, quantity, bought);
        if (quantity > 1){
            printf("'s for %d Vis!", quantity*val);
        }
        else if (quantity == 1){
            printf(" for %d Vis!", val);
        }
    }
}

/* Buy object to an NPC */
void
buy_objects(world_t *world, npc_t *npc, player_t *player){
    char to_buy[MAX_CITY_CHARS+1];
    char A[MAX_INVENTORY_ITEMS][MAX_CITY_CHARS+1];
    int i, j=0;
    if (strcmp(npc->shop_type, ARMOUR) == 0){
        printf("%s: I have the following %s Armour's for sale:\n", npc->name, npc->merchandise_type);
    }
    else {
        printf("%s: I have the following %s's for sale:\n", npc->name, npc->merchandise_type);
    }
    if (strcmp(npc->shop_type, WEAPON) == 0){
        for(i=0; i<world->num_weapons; i++){
            if (strcmp(world->weapons[i].type, npc->merchandise_type) == 0
                && world->weapons[i].level <= 84
                && !is_elite(world->weapons[i].name)){
                printf("%35s (lvl %2d)", world->weapons[i].name, world->weapons[i].level);
                strcpy(A[j++], world->weapons[i].name);
                if (j%3 == 0){
                    printf("\n");
                }
            }
        }
    }
    else if (strcmp(npc->shop_type, ARMOUR) == 0){
        for(i=0; i<world->num_armour; i++){
            if (strcmp(world->armours[i].type, npc->merchandise_type) == 0
                && world->armours[i].level <= 84
                && !is_elite(world->armours[i].name)){
                printf("%35s (lvl %2d)", world->armours[i].name, world->armours[i].level);
                strcpy(A[j++], world->armours[i].name);
                if (j%3 == 0){
                    printf("\n");
                }
            }
        }
    }
    else if (strcmp(npc->shop_type, ITEM) == 0){
        if (strcmp(npc->merchandise_type, GENERIC_SHOP) == 0){
            char B[MAX_INVENTORY_ITEMS][MAX_CITY_CHARS+1] = GENERIC_ITEMS;
            for(i=0; i<NUM_GENERIC_ITEMS; i++){
                if (find_item(world, B[i]) != NULL){
                    printf("%35s ", B[i]);
                    strcpy(A[j++], B[i]);
                }
                else{
                    fprintf(stderr, "Attempting to sell: %s which does not exist\n", A[i]);
                    assert(0);
                }
                if (j%3 == 0){
                    printf("\n");
                }
            }
        }
    }
    printf("\n\n");
    printf("%s: What would you like to buy? (Enter what you want to buy) ", npc->name);
    int index = -1;
    while (index == -1){
        index = input_npc_user(A, j, to_buy);
        if (index == -1){
            printf("\n%s: You entered %s, but I don't sell that, did you mean something else? ", npc->name, to_buy);
        }
    }
    if (strcmp(npc->shop_type, WEAPON) == 0){
        void* object = clone_object((void*)find_weapon(world, A[index]), sizeof(weapon_t));
        int val = ((weapon_t*)object)->val;
        /* If player can afford, add cloned weapon to inventory */
        if ((player->vis - val)  >= 0){
            player->inventory.add(&player->inventory, ((weapon_t*)object)->name,
                                  ((weapon_t*)object)->datatype, 1, object);
            player->vis -= val;
            bought_something_msg(npc->name, A[index], val, 1, WEAPON);
        }
        /* If player can't afford it be sure to free cloned object */
        else{
            printf("%s: You tried to buy %s, which costs %d, but you only have %d\n", npc->name, A[index], val, player->vis);
            free(object);
        }
    }
    else if (strcmp(npc->shop_type, ARMOUR) == 0){
        void* object = clone_object((void*)find_armour(world, A[index]), sizeof(armour_t));
        int val = ((armour_t*)object)->val;
        /* If player can afford, add cloned armour to inventory */
        if ((player->vis - val >= 0)){
            player->inventory.add(&player->inventory, ((armour_t*)object)->name,
                                  ((weapon_t*)object)->datatype, 1, object);
            player->vis -= val;
            bought_something_msg(npc->name, A[index], val, 1, ARMOUR);
        }
        else{
            printf("%s: You tried to buy %s, which costs %d, but you only have %d\n", npc->name, A[index], val, player->vis);
            free(object);
        }
    }
    else if (strcmp(npc->shop_type, ITEM) == 0){
        item_t* object = ((item_t*)clone_object((void*)find_item(world, A[index]), sizeof(item_t)));
        slot_t* in_inventory = player->inventory.find(&player->inventory, object->name);
        int inventory_quant = 0;
        if (in_inventory != NULL){
            inventory_quant = in_inventory->quantity;
        }

        int val = object->val;
        int quant = 1;
        do {
            printf("How many %s's would you like to buy? ", object->name);
            fscanf(stdin, "%d", &quant);
            if (quant > 0 && (quant + inventory_quant) > MAX_INVENTORY_ITEM_QUANT){
                printf("You tried to buy %d %s's. You have %d of them, and you cannot hold more than %d\n", quant, object->name, in_inventory->quantity, MAX_INVENTORY_ITEM_QUANT);
                Sleep(500);
            }
        } while (quant > 0 && (inventory_quant + quant) >= MAX_INVENTORY_ITEM_QUANT);




        if ((player->vis - (val*quant) >= 0)){
            add_vis(player, -val*quant);
            if (in_inventory != NULL){
                increase_item_quantity(&player->inventory, object->name, quant);
            }
            else{
                player->inventory.add(&player->inventory, object->name, object->datatype, quant, (void*)object);
            }
            bought_something_msg(npc->name, A[index], val, quant, ITEM);
        }
        else{
            printf("%s: You tried to buy %d %s's, which costs %d, but you only have %d\n", npc->name, quant, A[index], val*quant, player->vis);
            free(object);
        }
    }
}

/* Sell object to an NPC */
void
sell_objects(npc_t *npc, player_t *player){
    if (player->inventory.num_objects == 0){
        printf("%s: You don't have anything to sell.\n", npc->name);
        return;
    }
    char to_sell[MAX_CITY_CHARS+1];
    char A[MAX_INVENTORY_ITEMS][MAX_CITY_CHARS+1];
    int size = inventory_to_array(&player->inventory, A);
    printf("I can buy some of your things (Enter what you want to sell) ");

    slot_t *object = NULL;
    player->inventory.find(&player->inventory, to_sell);
    int index = 0;
    while (object == NULL){
        index = input_npc_user(A, size, to_sell);
        object = find_from_inventory(&player->inventory, A[index]);
        if (object == NULL){
            printf("%s: You don't have %s to sell to me, did you mean something else? ", npc->name, to_sell);
        }
    }
    /* Selling a weapon */
    if (strcmp(object->datatype, WEAPON) == 0){
        int wep_val = ((weapon_t*)object->item)->val;
        add_vis(player, wep_val);
        player->inventory.remove(&player->inventory, object->name, object->datatype, 1);
        sold_something_msg(npc->name, A[index], wep_val, 1, WEAPON);
    }
    /* Selling armour */
    else if (strcmp(object->datatype, ARMOUR) == 0){
        int arm_val = ((armour_t*)object->item)->val;
        add_vis(player, arm_val);
        player->inventory.remove(&player->inventory, object->name, object->datatype, 1);
        sold_something_msg(npc->name, A[index], arm_val, 1, ARMOUR);
    }
    /* Selling items */
    else{
        int item_val = ((item_t*)object->item)->val;
        int quant = SHRT_MAX+1;
        /* Must have sufficient quantity */
        while(quant > 0 && !(quant <= object->quantity)){
            printf("How many %s's would you like to sell? ", object->name);
            fscanf(stdin, "%d", &quant);
            if (quant > 0 && !(quant <= object->quantity)){
                printf("You have %d %s's, so you can't sell %d of them\n", object->quantity, object->name, quant);
                Sleep(500);
            }
        }
        add_vis(player, quant*item_val);
        sold_something_msg(npc->name, A[index], item_val, quant, ITEM);
        /* Not selling all, keep item in inventory, reduce quantity*/
        if (object->quantity - quant > 0){
            object->quantity -= quant;
        }
        /* Selling all, remove item from inventory */
        else if (object->quantity == quant){
            player->inventory.remove(&player->inventory, object->name, object->datatype, quant);
        }
        else{
            fprintf(stderr, "You tried to sell %d of %s, you have %d of that, something happened\n", quant, object->name, object->quantity);
            assert(0);
        }
    }
}

/* Prints information about a monster */
void
action_research_monster(world_t *world, npc_t *npc, player_t *player){
    char desired_monster[MAX_CITY_CHARS+1];
    char A[world->num_monsters][MAX_CITY_CHARS+1];
    int i;
    for(i=0; i<world->num_monsters; i++){
        strcpy(A[i], world->monsters[i].name);
    }
    printf("%s: What monster would you like to learn about? ", npc->name);

    int index = -1;
    while (index == -1){
        index = input_npc_user(A, world->num_monsters, desired_monster);
        if (index == -1){
            printf("\n%s: You entered %s, but I am not aware of that monster? ", npc->name, desired_monster);
        }
    }
    world->monsters[index].print_monster(&world->monsters[index]);
}

static int
use_item(inventory_t* inventory, slot_t* slot, int quant){
    printf("%dx %s left\n", slot->quantity-1, slot->name);
    assert(!strcmp(slot->datatype, ITEM) && "Not an item.");
    item_t *item = ((item_t*)slot->item);
    if ((slot->quantity - quant) >= 0){
        slot->quantity -= quant;
        inventory->value_inventory -= (quant*item->val);
    }
    else{
        fprintf(stderr, "Tried to use %d %s's, but only have %d of them.\n", quant, slot->name, slot->quantity);
        assert(0);
    }
    if ((slot->quantity == 0)){
        free(inventory->remove(inventory, slot->name, slot->datatype, 1));
        slot = NULL;
        return 2;
    }
    return 1;
}
/*****************************************************************************/
/************************* Enchanting Items Functions ************************/
/*****************************************************************************/

void
action_enchant_weparm(npc_t *npc, player_t *player){
    char to_enchant[MAX_WEPARM_CHARS+1];
    char A[MAX_INVENTORY_ITEMS][MAX_WEPARM_CHARS+1];
    int size = inventory_to_array(&player->inventory, A);
    printf("%s: What would you like to enchant (enter weapon or armour in inventory): ", npc->name);

    slot_t *object = NULL;
    player->inventory.find(&player->inventory, to_enchant);
    int index = 0;
    while (object == NULL){
        index = input_npc_user(A, size, to_enchant);
        object = find_from_inventory(&player->inventory, A[index]);
        if (object == NULL){
            printf("%s: You don't have %s to enchant, did you mean something else? ", npc->name, to_enchant);
        }
    }
    /* Attempting to enchant Weapon */
    if (strcmp(object->datatype, WEAPON) == 0){
        weapon_t* copy = ((weapon_t*)object->item);
        slot_t* chip = can_enchant_weparm(A, &player->inventory, copy->level, copy->name);
        int quant = chip->quantity;
        int proceeding = 1;

        if (chip == NULL || quant <= 0){
            printf("You do not have the required level enchantment chip.\n");
            return;
        }

        printf("Before Enchantment:\n");
        copy->print_weapon(copy);
        while(proceeding) {
            if (quant <= 0){
                printf("You do not have the required level enchantment chip.\n");
                return;
            }
            enchant(player, object, chip);

            printf("After Enchantment: \n");
            copy->print_weapon(copy);

            printf("Would you like to enchant again?\n");
            char response[MAX_CITY_CHARS+1];
            char A[][MAX_CITY_CHARS+1] = {"No", "Yes"};
            proceeding = -1;
            while (proceeding == -1){
                proceeding = input_npc_user(A, 2, response);
            }
            quant = chip->quantity;
        }
    }
    /* Attempting to enchant Weapon */
    if (strcmp(object->datatype, ARMOUR) == 0){
        armour_t* copy = ((armour_t*)object->item);
        slot_t* chip = can_enchant_weparm(A, &player->inventory, copy->level, copy->name);
        int quant = chip->quantity;
        int proceeding = 1;

        if (chip == NULL || quant <= 0){
            printf("You do not have the required level enchantment chip.\n");
            return;
        }

        printf("Before Enchantment:\n");
        copy->print_armour(copy);
        while(proceeding) {
            if (quant <= 0){
                printf("You do not have the required level enchantment chip.\n");
                return;
            }
            enchant(player, object, chip);

            printf("After Enchantment: \n");
            copy->print_armour(copy);

            printf("Would you like to enchant again?\n");
            char response[MAX_CITY_CHARS+1];
            char A[][MAX_CITY_CHARS+1] = {"No", "Yes"};
            proceeding = -1;
            while (proceeding == -1){
                proceeding = input_npc_user(A, 2, response);
            }
            quant = chip->quantity;
        }
    }
}

/* Returns inventory slot of lowest level enchantment chip that can enchant item or NULL */
static slot_t*
can_enchant_weparm(char A[][MAX_WEPARM_CHARS+1], inventory_t* inventory, int weparm_level, char* name){
    int i;
    int chips_to_test = 0;
    slot_t *chip = NULL;
    int initial = 80;
    int offset = 0;
    if(weparm_level > initial){
        offset = (weparm_level - initial)/4;
        printf("Offset: %d\n", offset);
        assert(offset >= 0);
        chips_to_test += offset;
        initial += (4*offset);
    }
    char enchantment_chips[NUM_ENCHANTMENT_CHIPS][MAX_WEPARM_CHARS+1] = ENCHANTMENT_CHIPS;
    /* An enchantment chip that is a higher level or equal to the level of the item can be used to enchant
     * the item. This attempts to the find lowest level enchantment chip that can be used to enchant the item
     * in the player's inventory in an upper triangular fashion.
     */
    while(chips_to_test <= NUM_ENCHANTMENT_CHIPS){
        if (weparm_level <= initial){
            for (i=chips_to_test; i<NUM_ENCHANTMENT_CHIPS; i++){
                chip = inventory->find(inventory, enchantment_chips[i]);
                printf("Testing: %s\n", enchantment_chips[i]);
                if (chip != NULL){
                    goto found;
                }
            }
            initial += 4;
        }
        chips_to_test++;
    }
    found: ;
    if (chip != NULL){
        return chip;
    }
    else{
        return NULL;
    }
}

void
reset_enchantments(slot_t *object){
    if (strcmp(object->datatype, WEAPON) == 0){
        weapon_t* copy = ((weapon_t*)object->item);
        int i;
        /* All pre-existing enhancements are reset */
        for(i=0; i<copy->num_enchantments; i++){
            free(copy->enchantments[i].type);
            copy->enchantments[i].val = 0;

        }
    }
    else if (strcmp(object->datatype, ARMOUR) == 0){
        armour_t* copy = ((armour_t*)object->item);
        int i;
        /* All pre-existing enhancements are reset */
        for(i=0; i<copy->num_enchantments; i++){
            free(copy->enchantments[i].type);
            copy->enchantments[i].val = 0;
        }

    }
}
/* Enchants a weapon or armour in your inventory at the enchantment merchant */
void
enchant(player_t *player, slot_t* object, slot_t *chip){
    if (strcmp(object->datatype, WEAPON) == 0){
        weapon_t* copy = ((weapon_t*)object->item);
        reset_enchantments(object);

        char wep_enchantments[NUM_WEP_ENCHANTMENTS][MAX_WEPARM_CHARS+1] = WEP_ENCHANTMENTS;
        int wep_enchant_prob[NUM_WEP_ENCHANTMENTS] = WEP_ENCHANT_PROB;
        int wep_enchant_max[NUM_WEP_ENCHANTMENTS] = WEP_ENCHANT_MAX;

        int new_num_enchantments = rand()%MAX_ENHANCEMENTS;
        int subtract = 0;   // Subtract number of times particular enchantment fails from number of enchantments
        int prev_enchant;   // Index of previous enchant
        int sum_prev_enchants;

        int i;
        for(i=0; i<new_num_enchantments; i++){

            /* Ensures we get a unique enchantment for each enchantment */
            int enchant = -1; // Index into wep_enchantments
            if (i==0){
                enchant = rand()%NUM_WEP_ENCHANTMENTS;
                prev_enchant = enchant;
                sum_prev_enchants = enchant;
            }
            else{
                enchant = rand()%NUM_WEP_ENCHANTMENTS;
                assert(NUM_WEP_ENCHANTMENTS <= 3 && "Refactor this code if you want more than 3 enhancements\n");
                while (enchant == prev_enchant || enchant == (sum_prev_enchants - prev_enchant)){
                    enchant = rand()%NUM_WEP_ENCHANTMENTS;
                }
                prev_enchant = enchant;
                sum_prev_enchants += enchant;
            }

            /* Calculate probability of attempted enchantment actually going into weapon */
            if (rand()%wep_enchant_prob[enchant]){
                copy->enchantments[i].type = malloc(sizeof(*wep_enchantments[enchant])*(strlen(wep_enchantments[enchant])+1));
                strcpy(copy->enchantments[i].type, wep_enchantments[enchant]);
                copy->enchantments[i].val = 1 + (rand()%wep_enchant_max[enchant]);
            }
            else{
                subtract++;
            }

        }
        copy->num_enchantments = new_num_enchantments - subtract;

    }
    else if (strcmp(object->datatype, ARMOUR) == 0){
        armour_t* copy = ((armour_t*)object->item);
        reset_enchantments(object);

        char arm_enchantments[NUM_ARM_ENCHANTMENTS][MAX_WEPARM_CHARS+1] = ARM_ENCHANTMENTS;
        int arm_enchant_prob[NUM_ARM_ENCHANTMENTS] = ARM_ENCHANT_PROB;
        int arm_enchant_max[NUM_ARM_ENCHANTMENTS] = ARM_ENCHANT_MAX;


        int new_num_enchantments = rand()%MAX_ENHANCEMENTS;
        int subtract = 0;   // Subtract number of times particular enchantment fails from number of enchantments
        int prev_enchant;   // Index of previous enchant
        int sum_prev_enchants;

        int i;
        for(i=0; i<new_num_enchantments; i++){

            /* Ensures we get a unique enchantment for each enchantment */
            int enchant = -1; // Index into arm_enchantments
            if (i==0){
                enchant = rand()%NUM_ARM_ENCHANTMENTS;
                prev_enchant = enchant;
                sum_prev_enchants = enchant;
            }
            else{
                enchant = rand()%NUM_ARM_ENCHANTMENTS;
                assert(new_num_enchantments <= 3 && "Refactor this code if you want more than 3 enchantments\n");
                while (enchant == prev_enchant || enchant == (sum_prev_enchants - prev_enchant)){
                    enchant = rand()%NUM_ARM_ENCHANTMENTS;
                }
                prev_enchant = enchant;
                sum_prev_enchants += enchant;
            }

            /* Calculate probability of attempted enchantment actually going into weapon */
            if (rand()%arm_enchant_prob[enchant]){
                copy->enchantments[i].type = malloc(sizeof(*arm_enchantments[enchant])*(strlen(arm_enchantments[enchant])+1));
                strcpy(copy->enchantments[i].type, arm_enchantments[enchant]);
                copy->enchantments[i].val = 1 + (rand()%arm_enchant_max[enchant]);
            }
            else{
                subtract++;
            }

        }
        copy->num_enchantments = new_num_enchantments - subtract;
    }
    use_item(&player->inventory, chip, 1);
}

/*****************************************************************************/
/************************* Upgrading Items Functions *************************/
/*****************************************************************************/

void
action_upgrade_weparm(npc_t *npc, player_t *player){
    char to_upgrade[MAX_WEPARM_CHARS+1];
    char A[MAX_INVENTORY_ITEMS][MAX_WEPARM_CHARS+1];
    int size = inventory_to_array(&player->inventory, A);
    printf("%s: What would you like to upgrade (enter weapon or armour in inventory): ", npc->name);

    slot_t *object = NULL;
    player->inventory.find(&player->inventory, to_upgrade);
    int index = 0;
    int can_afford = 0;
    while (object == NULL){
        index = input_npc_user(A, size, to_upgrade);
        object = find_from_inventory(&player->inventory, A[index]);
        if (object == NULL){
            printf("%s: You don't have %s to upgrade, did you mean something else? ", npc->name, to_upgrade);
        }
    }

    /* Attempting to upgrade Weapon */
    if (strcmp(object->datatype, WEAPON) == 0){
        weapon_t* copy = ((weapon_t*)object->item);

        /* Whether item cannot be upgraded further */
        if (!can_upgrade_weparm(copy->upgrade_level, npc->name, copy->datatype, copy->type)){
            return;
        }

        int cost = copy->val/3;
        can_afford = vis_subtract(player, cost);
        printf("%s: Upgrading %s costs %d. ", npc->name, copy->name, cost);

        /* Gets whether player wants to proceed with upgrade */
        int proceeding = proceed_with_upgrade(npc, copy->upgrade_level, copy->name);

        if (!proceeding){
            return;
        }
        if (!can_afford){
            printf("\n%s It cost %d to upgrade %s, but you only have %d.\n", npc->name, cost, copy->name, player->vis);
            return;
        }

        /* Attempts to upgrade player weapon, printing outcome of upgrade */
        int success = upgrade_successful(copy->upgrade_level);
        if(success){
            copy->upgrade_level++;
            printf("\n%s: Upgraded: %s from +%d to +%d\n", npc->name, copy->name, copy->upgrade_level-1, copy->upgrade_level);
        }
        else{
            printf("\n%s: Unfortunately %s broke when trying to upgrade.\n", npc->name, copy->name);
            player->inventory.remove(&player->inventory, copy->name, WEAPON, 1);
        }
    }
    else if (strcmp(object->datatype, ARMOUR) == 0){
        armour_t* copy = ((armour_t*)object->item);
        /* Whether item cannot be upgraded further */
        if (!can_upgrade_weparm(copy->upgrade_level, npc->name, copy->datatype, copy->type)){
            return;
        }
        int cost = copy->val/3;
        can_afford = vis_subtract(player, cost);
        printf("%s: Upgrading %s costs %d. ", npc->name, copy->name, cost);

        /* Gets whether player wants to proceed with upgrade */
        int proceeding = proceed_with_upgrade(npc, copy->upgrade_level, copy->name);;

        if (!proceeding){
            return;
        }

        if (!can_afford){
            printf("\n%s It cost %d to upgrade %s, but you only have %d.\n", npc->name, cost, copy->name, player->vis);
            return;
        }

        /* Attempts to upgrade player weapon, printing outcome of upgrade */
        int success = upgrade_successful(copy->upgrade_level);
        if(success){
            copy->upgrade_level++;
            printf("\n%s: Successfully Upgraded %s from +%d to +%d\n", npc->name, copy->name, copy->upgrade_level-1, copy->upgrade_level);
        }
        else{
            printf("\n%s: Unfortunately %s broke when trying to upgrade.\n", npc->name, copy->name);
            player->inventory.remove(&player->inventory, copy->name, WEAPON, 1);
        }
    }
}

/* Returns whether maximum upgrade level for weapon already reached */
static int
can_upgrade_weparm(int curr_upgrade_level, char* name, char *datatype, char *type){
    if ((strcmp(datatype, ARMOUR) == 0) && (strcmp(type, "Chest") == 0)){
        printf("%s: You cannot upgrade %s's\n", name, type);
    }
    else if (curr_upgrade_level >= MAX_UPGRADE_LEVEL){
        printf("%s: You cannot upgrade items above +%d\n", name, MAX_UPGRADE_LEVEL);
        return 0;
    }
    return 1;
}

/* Asks player whether they want to continue with upgrade, prints warning message if potential for upgrade to delete item */
static int
proceed_with_upgrade(npc_t *npc, int curr_upgrade_level, char* name){

    if (curr_upgrade_level < GUARANTEED_UPGRADE_LEVEL){
        printf("Do you wish to proceed? ");
    }
    else{
        unsigned int power  = 1 << ((curr_upgrade_level+1)-GUARANTEED_UPGRADE_LEVEL);
        printf("Warning you may lose +%d %s during this upgrade, there is a %lf.2%% chance of success, do you wish to proceed? ",
                curr_upgrade_level, name, 100.0/power);

    }

    /* Gets player response on whether they wish to continue */
    char response[MAX_CITY_CHARS+1];
    char A[][MAX_CITY_CHARS+1] = {"No", "Yes"};
    int proceeding = -1;
    while (proceeding == -1){
        proceeding = input_npc_user(A, 2, response);
    }
    return proceeding;
}

/* Returns 1 if upgrade successful, 0 if unsuccessful */
static int
upgrade_successful(int curr_upgrade_level){
    if (curr_upgrade_level < GUARANTEED_UPGRADE_LEVEL){
        return 1;
    }

    else{
        // +4 -> +5 50%, +5 -> +6 25%, etc
        unsigned int power  = 1 << ((curr_upgrade_level+1)-GUARANTEED_UPGRADE_LEVEL);
        double success_rate = 1.0/power;
        printf("Success Rate: %lf\n", success_rate);
        if (rand()%power){
            return 1;
        }
    }
    return 0;
}

void
pioneering_merchant_exchange(world_t *world, npc_t *npc, player_t *player){
    if (player->level < 100){
        printf("%s: Hello %s. Unfortunately I cannot do anything for you now, but, when "
               "you reach level 100, I can give you some really good weapons and armour "
               "for the more difficult areas to explore in exchange for some loot I've "
               "been looking for. Come back then!\n", npc->name, player->name);
        return;
    }
    printf("%s: Hello %s. I have lots of Level 100 Pioneering Equipment I can give you to "
           "help your expedition. If you want any, bring me the following:\n", npc->name, player->name);
    printf("\t250x Pure Talt\n\t250x Pure Ionium\n\t250x Pure Aidanium\n\t250x Pure Quartz\n\t250x Pure Etretanium\n");
    printf("%s: I have the following Pioneering Gear\n", npc->name);
    int i, j = 0;
    char A[30][MAX_CITY_CHARS+1];
    for(i=0; i<world->num_weapons; i++){
        if (memcmp(world->weapons[i].name, "Pioneer", sizeof(char)*strlen("Pioneer")) == 0){
            printf("\t%s\n", world->weapons[i].name);
            strcpy(A[j++], world->weapons[i].name);
        }
    }
    printf("\n%s: What Pioneering Gear would you like? ", npc->name);
    char desired[MAX_CITY_CHARS+1];
    int op = -1;
    while(op == -1){
        op = input_npc_user(A, j, desired);
        if (op == -1){
            printf("%s: You entered %s, but I don't have that unfortunately\n", npc->name, desired);
        }
    }
    slot_t* pure_talt = player->inventory.find(&player->inventory, "Pure Talt");
    slot_t* pure_ionium = player->inventory.find(&player->inventory, "Pure Ionium");
    slot_t* pure_aidanium = player->inventory.find(&player->inventory, "Pure Aidanium");
    slot_t* pure_quartz = player->inventory.find(&player->inventory, "Pure Quartz");
    slot_t* pure_etretanium = player->inventory.find(&player->inventory, "Pure Etretanium");

    if (pure_talt == NULL || pure_ionium == NULL || pure_aidanium == NULL || pure_quartz == NULL || pure_etretanium == NULL){
        printf("%s: You do not have the required resources to exchange. Come back when you do\n", npc->name);
        return;
    }
    else if (pure_talt->quantity < 250 || pure_ionium->quantity < 250 || pure_aidanium->quantity < 250
             || pure_quartz->quantity < 250 || pure_etretanium->quantity < 250){
        printf("%s: You do not have the required resources to exchange. Come back when you do\n", npc->name);
        return;
    }

    weapon_t* wep_temp = find_weapon(world, A[op]);
    if (wep_temp != NULL){
        wep_temp = ((weapon_t*)clone_object(wep_temp, sizeof(weapon_t)));
        player->inventory.add(&player->inventory, wep_temp->name, wep_temp->datatype, 1, wep_temp);
    }
}
/* Executes action with NPC */
void
execute_action_npc(world_t *world, npc_t *npc, player_t *player, char* action){
    if(!strcmp(action, "Rock Paper Scissors")){
        rock_paper_scissors(npc, player);
    }
    else if (!strcmp(action, "Finished")){
        printf("%s: Goodbye\n", npc->name); Sleep(500);
    }
    else if (!strcmp(action, "Sell")){
        sell_objects(npc, player);
    }
    else if (!strcmp(action, "Buy")){
        buy_objects(world, npc, player);
    }
    else if (!strcmp(action, "Research Monster")){
        action_research_monster(world, npc, player);
    }
    else if (!strcmp(action, "Upgrade")){
        action_upgrade_weparm(npc, player);
    }
    else if (!strcmp(action, "Enchant")){
        action_enchant_weparm(npc, player);
    }
    else if (!strcmp(action, "Talk")){
        printf("%s: Got nothing to say to you kiddo!\n", npc->name);
    }
    else if (!strcmp(action, "Exchange")){
        pioneering_merchant_exchange(world, npc, player);
    }
}

void
desired_action_npc(world_t *world, player_t *player){
    node_t *temp = find_node(world->parent, player->location);
    /* No NPCs in location */
    if (temp->info.num_npcs <= 0){
        return;
    }

    char name[MAX_CITY_CHARS+1];
    int option = -1;
    while(option == -1){
        printf("Which NPC do you want to interact with? (Type their name)\n");
        int i;
        for(i=0; i<temp->info.num_npcs; i++){
            printf("%25s", temp->info.npcs[i].name);
            if ((i+1)%3 == 0){
                printf("\n");
            }
        }
        printf("\n");
        char npc_names[temp->info.num_npcs][MAX_CITY_CHARS+1];
        for(i=0; i<temp->info.num_npcs; i++){
            strcpy(npc_names[i], temp->info.npcs[i].name);
        }
        option = input_npc_user(npc_names, temp->info.num_npcs, name);
        if(option == -1){
            printf("You entered: %s; not sure which NPC you were referring to, please try again.\n", name);
            Sleep(1500);
        }
    }

    int op = -1;
    char action[MAX_CITY_CHARS+1];
    while(op == -1){
        printf("%s: Welcome! What can I do ye' for (Type an action displayed)?\n", temp->info.npcs[option].name);
        int i;
        for(i=0; i<temp->info.npcs[option].num_actions; i++){
            printf("\t%s\n", temp->info.npcs[option].actions[i]);
        }
        op = input_npc_user(temp->info.npcs[option].actions, temp->info.npcs[option].num_actions, action);
        if (op == -1){
            printf("%s: I don't know what you mean by %s, please try again.\n", temp->info.npcs[option].name, action);
            Sleep(1500);
        }
    }
    execute_action_npc(world, &temp->info.npcs[option], player, temp->info.npcs[option].actions[op]);
}

int
input_npc_user(char A[][MAX_CITY_CHARS+1], int n, char name[MAX_CITY_CHARS+1]){
    getword(name, MAX_CITY_CHARS+1);
    int hamming_d = MAX_CITY_CHARS;
    double dice_co = -1;
    double dice_co_prev = -1;
    double dice_epsilon = 0.1; // error variable
    int option_hamming = -1;
    int option_dice_coefficient = -1;
    int i;

    for(i=0; i<n; i++){
        /* Gets option based on hamming distance */
        if (strlen(name) == strlen((A[i]))){
            int temp_hamming = hamming_distance(name, A[i]);
            //printf("%s, %s: hamming: %d\n", name, A[i], temp_hamming);
            if(temp_hamming < hamming_d && hamming_d != -1){
                if (temp_hamming == 0){
                    return i;
                }
                hamming_d = temp_hamming;
                option_hamming = i;
            }
        }
        /* Gets option based on dice_coefficient */
        double val = dice_coefficient(name, A[i], 2);
        if (val > dice_co){
            if (i == 0){
                ; // Do nothing
            }
            else {
                dice_co_prev = dice_co; // We want control for very similar npc names so keep track of second highest
            }
            dice_co = val;
            option_dice_coefficient = i;
        }
    }
    //printf("Hamming Score:      %d, Option Hamming: %d\n", hamming_d, option_hamming);
    //printf("Dice Coefficient: %.2lf, Option Dice:    %d\n", dice_co, option_dice_coefficient);
    //printf("Dice Coefficient Prev: %.2lf\n",dice_co_prev);

    if (hamming_d <= 2
        && hamming_d != -1
        && (hamming_d/strlen(A[option_hamming]) < .41)){
        return option_hamming;
    }
    else if(dice_co > DICE_COEFFICIENT_THRESHOLD
            && (dice_co-dice_epsilon) > dice_co_prev){
        return option_dice_coefficient;
    }
    return -1;

}

/* Returns hamming distance between two strings, or -1 if different size */
int
hamming_distance(char* str1, char* str2){
    /* Hamming distances takes as an input 2 strings of the same length */
    if(strlen(str1) != strlen(str2)){
        fprintf(stderr, "Tried to take hamming distance of different sized strings."
                        "\n%s and %s\n", str1, str2);
        return -1;
    }
    int i, hamming_d = 0;
    for(i=0; i<strlen(str1); i++){
        hamming_d += (tolower(str1[i]) != tolower(str2[i]));
    }
    return hamming_d;

}

/* Returns dice coefficient between two strings by n-gram comparison */
double
dice_coefficient(char* str1, char* str2, int n){
    /* Note str2 is the npc and str1 is the users input */
    if (strlen(str2) < n || strlen(str1) < n){
        return 0.0; // We do not consider this; if they are the same length, hamming_distance handles it
    }
    /* q-gram store here */
    char X[MAX_CITY_CHARS-n+1][n+1];
    int X_len = 0;

    /* Create q-gram */
    for(X_len=0; X_len<(int)strlen(str2)-n+1; X_len++){
        memcpy(X+X_len, str2+X_len, n);
        X[X_len][n] = '\0';
    }

    int i, match = 0;
    /* Match q-grams */
    for(i=0; i<X_len; i++){
        /* A match is found n-gram is a substring, and is the last substring (unique)
         * in the text
         */
        char* sub_str = mystrcasestr(str1, X[i]);
        /* q-gram must be a substring */
        if (sub_str != NULL){
            /* a unique substring for there to be a match */
            match+= (mystrcasestr(sub_str+1, X[i]) == NULL);
        }
    }
    return (2.0*match)/((int)strlen(str1)+(int)strlen(str2));
}

int
action_menu(world_t *world, player_t *player){
    int repeat;             // Whether to repeat getting player action
    int option;             // Players desired action
    int max_actions = world->num_menu_actions -1;    // Maximum actions player can execute (from 0)
    int i, offset;
    /* Get action player wants */
    do {
        printf("You are currently in: %s (", player->location);
        node_t *temp = find_node(world->parent, player->location);
        if (temp->info.city == 1){
            printf("City)\n");
        }
        else{
            printf("Wild)\n");
        }
        printf("What action would you like to take?\n");
        offset = 0;
        for(i=0; i<world->num_menu_actions; i++){
            /* Waypoint is a substring of current menu action being evaluated */
            if (mystrcasestr(world->menu_actions[i], "Waypoint")){
                if (temp->info.waypoint){
                    ; // We want to print the option
                }
                else{
                    offset--;
                    continue;
                }
            }
            printf("\t(%d) %s\n", i+offset, world->menu_actions[i]);
        }
        fscanf(stdin, " %d", &option);
        int no_offest_option = option;
        option -= offset;
        repeat = option>max_actions || no_offest_option < 0;

        if (repeat){
            printf("WARNING\nInteger entered too large or small, please select an option again\n\n");
            Sleep(1500);
        }
    }while(repeat);

    /* Execute Action */
    switch (option)
    {
        case 0: action_waypoint(world, player);
            break;
        case 1: action_exit_location(world, player);
            break;
        case 2: action_wander_around(world, player);
            Sleep(1500); // Add more complexity to Walk around later;
            break;
        case 3: player->display_player_info(player);
            Sleep(1500);
            break;
        case 4: player->display_combat_stats(player);
            Sleep(1500);
            break;
        case 5: player->display_apparel(player);
            Sleep(1500);
            break;
        case 6: action_modify_apparel(world, player);
            Sleep(1500);
            break;
        case 7: player->display_inventory(&player->inventory);
            Sleep(1500);
            break;
        case 8: desired_action_npc(world, player);
            Sleep(1500);
            break;
        case 9: return 0;
        default:
            break;
    };
    return 1;
}

void
afk_farm(world_t *world, player_t *player, int n){
    int killed_status = 1;
    int i = 0;
    int init_level = player->level;
    unsigned int init_exp = player->experience;
    while(killed_status && i < n){
        monster_t *monster_encountered = encounter_monster(world, player);
        if (monster_encountered == NULL){
            return; // No monsters in location added yet
        }
        printf("Encountered monster: %s\n", monster_encountered->name);
        killed_status = battle_monster(player, monster_encountered);

        if (killed_status){
            unsigned int exp_gained = exp_from_kill(player, monster_encountered);
            loot_dead_monster(world, player, monster_encountered);
            /* Maximum Experience allowed to prevent overflow */
            if (player->experience == UINT_MAX){
                continue;
            }
            /* Overflow test  -- remember wrap-around and non-commutativity*/
            else if (player->experience + exp_gained < player->experience){
                player->experience = UINT_MAX;
            }
            /* Normal */
            else {
                player->experience += exp_gained;
                player->level_up(world, player);
            }
        }
        i++;
    }
    printf("Level: %d -> %d, gained %d levels\n", init_level, player->level, player->level - init_level);
    printf("Gained: %u Experience\n", player->experience - init_exp);
}

void
action_wander_around(world_t *world, player_t *player){
    node_t *temp = find_node(world->parent, player->location);
    assert(temp != NULL);
    /* Monsters only exist in non-cities */
    if (temp->info.city == 0){
        afk_farm(world, player, 5000);
        return;
        }

    /* Can't battle in a city */
    else return;
}

/* Options to modify what player has equipped */
void
action_modify_apparel(world_t *world, player_t *player){
    int repeat;
    int option;
    int max = 3;
    /* do get player option while they haven't selected valid option yet */
    do {
        printf("What do you want to do?\n");
        printf("(1) Equip Something\n");
        printf("(2) Unequip Something\n");
        printf("(3) Go back\n");
        fscanf(stdin, " %d", &option);
        fflush(stdin); // Fix later to make it

        repeat = option>max || option < 1; // Boolean tested in while loop
        if (repeat){
            printf("WARNING\nInteger entered too large or small,"
                   "please select an option again\n\n");
            Sleep(1500);
        }
    }while(repeat);

    char name[MAX_WEPARM_CHARS+1]; //wep/armour player enters

    switch(option){
        /* Find object in inventory, equip it, remove it from inventory */
        case 1:;
            printf("What do you want to equip? Enter here: ");
            getword(name, MAX_WEPARM_CHARS);
            slot_t* temp = player->inventory.find(&player->inventory, name);
            if (temp == NULL){
                printf("%s not in inventory, check spelling and case sensitivity.\n", name);
                Sleep(500);
                printf("-\n");
                Sleep(500);
                printf("-\n");
                return;
            }
            printf("Name: %s, Data Type: %s\n", temp->name, temp->datatype);
            player->equip(player, temp->datatype, temp->item);
            break;
        /* Find object in apparel, remove it from apparel, add it to inventory */
        case 2:;
            printf("What do you want to unequip? Enter here: ");
            getword(name, MAX_WEPARM_CHARS);
            player->unequip(player, name);
            break;
        /* Back to main menu */
        case 3:
            return;
        default:
            return;
    }
}

int
len_tree(node_t *root){
    if (root == NULL){
        return 0;
    }
    return(len_tree(root->left) + 1 + len_tree(root->right));
}

/* Shallow copy src to dest and return dest.
 * This is fine since we do not want to modify the pointers in the relevant structs ever.
 * For memory management, we can easily free these clones, saving the freeing of
 * the whole game object on program termination.
 */
void*
clone_object(void* src, size_t src_size){
    assert(src_size == sizeof(weapon_t)
           || src_size == sizeof(item_t)
           || src_size == sizeof(armour_t));
    void* dest = NULL;
    dest = malloc(src_size);
    assert(dest != NULL);
    memcpy(dest, src, src_size);
    return dest;
}

/*****************************************************************************/
/************************** Combat Related Functions *************************/
/*****************************************************************************/

/* Finds monster in location to encounter/battle */
static monster_t* encounter_monster(world_t *world, player_t *player){
    node_t *temp = find_node(world->parent, player->location);
    assert (temp != NULL);
    if (temp->info.num_monsters == 0){
        fprintf(stderr, "Tried to find monsters in: %s,"
                "but there are no monsters here\n", player->location);
        return NULL;
    }
    /* Return monster encountered - if it's a boss,
     * only return the boss 10% of the time given it was encountered*/
    for (;;){
        monster_t *to_return = &temp->info.monsters[rand()%(temp->info.num_monsters-1)];
        if (!to_return->boss){
            return to_return;
        }
        else{
            if (rand()%100 <= BOSS_PERCENT){
                return to_return;
            }
        }
    }
}

/* Player fights a monster; they either kill it, or die and respawn */
static int battle_monster(player_t *player, monster_t *monster){
    int player_damage_to_monster = player_damage_calc(player, monster);
    printf("Player damage to monster: %d\n", player_damage_to_monster);
    int monster_damage_to_player = monster_damage_calc(player, monster);
    int monster_hp = monster->hp;
    printf("%s did %d damage to player\n",
           monster->name, monster_damage_to_player);
    while(monster_hp > 0){
        monster_hp -= player_damage_to_monster;
        player->combat_stats.cur_hp -= monster_damage_to_player;
        /* Restore 10% of player's max health per cycle, equivalent of a Scout heal */
        restore_health(player, player->combat_stats.max_hp/HEAL_PERCENT);
        if (player->combat_stats.cur_hp <= 0){
            printf("You died to a %s (lvl %d). "
                   "You are being teleported back to: %s\n",
                   monster->name, monster->level, DEFAULT_START_LOC);
            strcpy(player->location, DEFAULT_START_LOC);
            player->combat_stats.cur_hp = player->combat_stats.max_hp;
            Sleep(3000);
            return 0; // Player died
        }
    }
    if (monster_hp <= 0){
        /* Take the monsters health, shift decimal place left twice
         * and restore 30x that number to players health~
         * Equivalent to a health loot pick-up
         */
        restore_health(player, ((monster->hp/100)*30));
    }
    return monster_hp<=0; // Player killed monster
}

/* Returns damage player does to monster */
static int player_damage_calc(player_t *player, monster_t *monster){
    double atk = player->combat_stats.atk;
    int crit_chance = player->combat_stats.crit_chance;

    //printf("Initial Attack: %d, Initial AR: %d\n", (int)atk, player->combat_stats.ar);
    atk *= ATTACK_MODIFIER; // By default increases attack by 60%
    if (rand()%100 < crit_chance){
        atk *= 2; // Crit Chance doubles atk
    }
    //printf("Attack after modifier: %d\n", (int)atk);
    int dADR = player->combat_stats.ar - monster->dr; // Difference between ar and dr;
    if (dADR > 0){
        double bonus = abs(3-dADR)*DADR_MODIFIER;
        if (bonus > 2){
            atk *= 3;
        }
        else{
            atk *= (1 + bonus);
        }
    }
    else if(dADR < 0){
        double reduction = (1-dADR)*.1;
        if (dADR > 11){
            return 1;
        }
        else{
            atk*= (1 - reduction);
        }
    }
    //printf("dADR: %d, Attack after dADR calc: %d\n",dADR, (int)atk);

    float damage_reduction = 0;
    damage_reduction = monster->def / 2 * 0.01;
    if (damage_reduction > MAX_DAMAGE_REDUCTION){
        damage_reduction = MAX_DAMAGE_REDUCTION;
    }
    //printf("Monster: %s Defence: %d, damage reduction: %f\n", monster->name, monster->def, damage_reduction);
    atk*= (1-damage_reduction);
    //printf("Attack after damage reduction: %d\n", (int)atk);
    if (atk == 0){
        assert(0 && "Check Function, will infinite loop");
    }
    return (int)atk*3; // Multiply by 3 to take into account original game has 3 characters.

}

/* Returns damage monster does to player */
static int monster_damage_calc(player_t *player, monster_t *monster){
    double monster_atk = monster->atk;

    int dADR = monster->ar - player->combat_stats.dr;
    if (dADR > 0){
        double bonus = abs(3-dADR)*DADR_MODIFIER;
        if (bonus > 2){
            monster_atk *= 3;
        }
        else{
            monster_atk *= (1 + bonus);
        }
    }
    else if(dADR < 0){
        double reduction = (1-dADR)*.1;
        if (dADR > 11){
            return 0;
        }
        else{
            monster_atk*= (1 - reduction);
        }
    }
    float damage_reduction = 0;
    damage_reduction = player->combat_stats.def / 2 * 0.01;
    if (damage_reduction > MAX_DAMAGE_REDUCTION){
        damage_reduction = MAX_DAMAGE_REDUCTION;
    }
    monster_atk *= (1 - damage_reduction);
    return (int)monster_atk*3;
}

/* Restores health to player ensuring maximum health not exceeded */
static void restore_health(player_t *player, int health){
    player->combat_stats.cur_hp += health;
    if (player->combat_stats.cur_hp > player->combat_stats.max_hp){
        player->combat_stats.cur_hp = player->combat_stats.max_hp;
    }
}

/* Returns experience given from killing a monster based on the relative
 * difference between the monster level and the player level
 */
static unsigned int
exp_from_kill(player_t *player, monster_t *monster){
    unsigned int base_exp = monster->exp;
    unsigned int percent_modifier = 0;
    int level_difference  = abs(player->level - monster->level);
    /* Player more than outer bound (10) levels apart from monster level */
    if (level_difference > LEVEL_OUTER_BOUND
        && player->level > monster->level){
        /* Player level well above monster level, no experience given */
        if (player->level <= 100
            && level_difference > (LEVEL_OUTER_BOUND + (player->level / LEVEL_OUTER_BOUND))){
            ;
        }
        /* Player level too high relative to monster given > level 100, no experience given */
        else if (player->level > 100){
            ;
        }
        /* Player level above monster level, but still some experience given */
        else {
            percent_modifier = 6; // 60%
        }
    }
    /* Player less than 2 times the outer bound (10*2) levels apart from monster level */
    else if (level_difference > (2*LEVEL_OUTER_BOUND)
             && player->level < monster->level){
        percent_modifier = 12; // 120%
    }
    /* Player 5 levels below monster */
    else if (level_difference > 5
             && player->level < monster->level){
        percent_modifier = 14; // 140%
    }
    else{
        if (player->level < 100){
            unsigned int addition = (player->level/20);
            percent_modifier = 10 + addition;
        }
        else{
            percent_modifier = 15;
        }
    }
    //unsigned int to_return = ((base_exp * percent_modifier) / 10);
    //printf("Level Difference: %d, Percent Modifier: %u, Experience: %u\n", level_difference, percent_modifier, to_return);
    return ((base_exp * percent_modifier) / 10);
}

void
loot_dead_monster(world_t *world, player_t *player, monster_t *monster){
    int j;
    for(j=0; j<monster->num_drops; j++){
        loot_t* loot = dict_search(world->loot_table, monster->drop_list[j]);
        if (loot == NULL){
            printf("Dropped Item: %s\n", monster->drop_list[j]);
        }
        assert(loot != NULL);
        if (!(rand()%loot->rarity)){
            if (find_item(world, monster->drop_list[j]) != NULL){
                item_t *temp = find_item(world, monster->drop_list[j]);
                assert(temp != NULL);
                if (player->inventory.find(&player->inventory, temp->name) == NULL){
                    item_t* to_add = clone_object(temp, sizeof(item_t));
                    player->inventory.add(&player->inventory, to_add->name, to_add->datatype, 1, (void*)to_add);
                }
                else{
                    increase_item_quantity(&player->inventory, temp->name, 1);
                }
            }
            else if (find_weapon(world, monster->drop_list[j]) != NULL){
                weapon_t *temp = find_weapon(world, monster->drop_list[j]);
                assert(temp != NULL);
                if (player->inventory.find(&player->inventory, temp->name) == NULL){
                    player->inventory.add(&player->inventory, temp->name, temp->datatype, 1, clone_object(temp, sizeof(weapon_t)));
                }
                printf("You would loot: %s\n", temp->name);
            }
            else if (find_armour(world, monster->drop_list[j]) != NULL){
                armour_t *temp = find_armour(world, monster->drop_list[j]);
                assert(temp != NULL);
                if (player->inventory.find(&player->inventory, temp->name) == NULL){
                    player->inventory.add(&player->inventory, temp->name, temp->datatype, 1, clone_object(temp, sizeof(armour_t)));
                }
                printf("You would loot: %s\n", temp->name);
            }
        }
    }
}
/* Levels up player if they have sufficient experience, and adjusts relevant stats */
static void
level_up (world_t *world, player_t *player){
    while(player->level != MAX_LVL
          && player->experience > world->experience_table[player->level].cum_experience){
        player->level++;
        player->combat_stats.max_hp += HP_PER_LVL;
        player->combat_stats.cur_hp = player->combat_stats.max_hp;
        int curr_bonus = player->combat_stats.ardr_level_bonus;
        player->combat_stats.ardr_level_bonus = player->level/4;
        curr_bonus -= player->combat_stats.ardr_level_bonus;
        player->combat_stats.ar-=curr_bonus;
        player->combat_stats.dr-=curr_bonus;
    }
}


/*****************************************************************************/
/****************************** World Functions ******************************/
/*****************************************************************************/

/* Creates empty world to be populated with the game state */
void
create_world(world_t *world){
    assert(world != NULL);
    world->parent = NULL;

    world->experience_table = malloc(sizeof(*world->experience_table) * MAX_LVL-1);
    assert(world->experience_table != NULL);

    world->weapons = malloc(sizeof(*world->weapons) * INIT_ALLOC);
    assert(world->weapons != NULL);
    world->allocated_weapons = INIT_ALLOC;
    world->num_weapons = 0;

    world->armours = malloc(sizeof(*world->armours) * INIT_ALLOC);
    assert(world->armours != NULL);
    world->allocated_armour = INIT_ALLOC;
    world->num_armour = 0;

    world->items = malloc(sizeof(*world->items) * INIT_ALLOC);
    assert(world->items != NULL);
    world->allocated_items = INIT_ALLOC;
    world->num_items = 0;

    world->monsters = malloc(sizeof(*world->monsters) * INIT_ALLOC);
    assert(world->monsters != NULL);
    world->allocated_monsters = INIT_ALLOC;
    world->num_monsters = 0;

    world->npcs = malloc(sizeof(*world->npcs) * INIT_ALLOC);
    assert(world->npcs != NULL);
    world->allocated_npcs = INIT_ALLOC;
    world->num_npcs = 0;

    world->loot_table = malloc(sizeof(*world->loot_table));
    create_hashtable(world->loot_table, HASH_TABLE_SIZE);

    world->display_exp_table = &print_levels_table;
    world->display_locations = &print_locations;
    world->location_edges = &print_location_edges;
    world->display_weapons = &print_games_weapons;
    world->display_armours = &print_games_armour;
    world->display_items = &print_games_items;
    world->display_monsters = &print_monsters;
    world->display_npcs = &print_games_npcs;
    world->add_monster = &add_monster_to_location;


}

/* Print all locations in world */
void
print_locations(node_t *node){
    if (node){
        print_locations(node->left);
        printf("Location Name (%p): %s, waypoint: %d, num npcs: %d\n", node, node->info.name, node->info.waypoint, node->info.num_npcs);
        print_locations(node->right);
    }
}

static void
print_location_edges(world_t *world, char* location){
    int i;
    node_t *temp = find_node(world->parent, location);
    for(i=0; i<temp->info.num_edges;i++){
        printf("\t(%d) %s\n", i, temp->info.edges[i]);
    }
}

/* Prints level tabel in the wordl to stdout */
void
print_levels_table(world_t *world){
    printf("\n%7s %20s %20s\n", "Level", "Experience till next", "Cumulative Experience");
    int i;
    for(i=0; i<MAX_LVL; i++){
        printf("%7d %20u %20u\n", world->experience_table[i].level,
                                 world->experience_table[i].experience_till_next,
                                 world->experience_table[i].cum_experience);
    }
}

/* Prints all monsters in the world to stdout */
static void
print_monsters(world_t *world){
    printf("There are %d monsters in the game!\n", world->num_monsters);
    int i;
    for(i=0; i<world->num_monsters; i++){
        print_monster(&world->monsters[i]);
    }
}

/* Prints all of the games default weapons to stdout */
static void
print_games_weapons(world_t *world){
    int i;
    printf("There are %d Weapons in the game!\n\n", world->num_weapons);
    for(i=0; i<world->num_weapons; i++){
        world->weapons[i].print_weapon(&world->weapons[i]);
    }
    printf("\n");
}

/* Prints all of the games default armour to stdout */
static void
print_games_armour(world_t *world){
    int i;
    printf("There are %d types of Armour in the game!\n\n", world->num_armour);
    for(i=0; i<world->num_armour; i++){
        world->armours[i].print_armour(&world->armours[i]);
    }
    printf("\n");
}

/* Prints all of the games items to stdout */
static void
print_games_items(world_t *world){
    int i;
    printf("There are %d Items in the game!\n\n", world->num_items);
    for(i=0; i<world->num_items;i++){
        print_item(&world->items[i]);
    }
}

/* Prints out all of the games generic NPCs to stdout */
static void
print_games_npcs(world_t *world){
    int i;
    printf("There are %d npcs in the game!\n\n", world->num_npcs);
    for(i=0; i<world->num_npcs; i++){
        print_npc(&world->npcs[i]);
    }
}

void
free_locations(node_t *node){
    if (node){
        free_locations(node->left);
        free_locations(node->right);

        free(node->info.name);

        int i;
        for(i=0; i<node->info.num_edges; i++){
            free(node->info.edges[i]);
        }


        free(node->info.monsters);
        free(node->info.npcs);
    }

}
/* Free's all dynamically allocated memory in the world */
void
free_world(world_t *world){


    int i;
    for(i=0; i<world->num_weapons; i++){
        free_weapon(&world->weapons[i]);
    }

    free(world->weapons);
    printf("Freed all weapons\n");

    free_locations(world->parent);
    free(world->parent);

    for(i=0; i<world->num_armour; i++){
        free_armour(&world->armours[i]);
    }
    free(world->armours);
    printf("Freed all armour\n");

    for(i=0; i<world->num_items; i++){
        free_item(&world->items[i]);
    }
    free(world->items);
    printf("Freed all items\n");

    free(world->experience_table);
    printf("Freed the experience table\n");

    for(i=0; i<world->num_monsters; i++){
        free_monster(&world->monsters[i]);
    }
    free(world->monsters);
    printf("Freed all monsters\n");

    free_dict(world->loot_table);
    free(world->loot_table);
    printf("Freed all loot table\n");
}

/*****************************************************************************/
/***************************** Player Functions ******************************/
/*****************************************************************************/

/* Creates new player */
void
create_player(player_t *player){
    player->vis = START_VIS;
    player->level = STARTING_LEVEL;
    player->experience = STARTING_EXPERIENCE;

    player->level_up = &level_up;
    player->display_inventory = &print_inventory;
    player->display_player_info = &print_player_info;
    player->display_combat_stats = &display_combat_stats;
    player->enter_locn = &enter_location;
    player->display_apparel = &display_apparel;
    player->equip = &equip;
    player->unequip = &unequip;

    /* Inventory */
    create_inventory(&player->inventory);

    /* Combat Stats */
    create_combat_stats(&player->combat_stats);

    /* Apparel */
    create_apparel(&player->apparel);

    /* Location */
    char buf[] = DEFAULT_START_LOC;
    int size = sizeof(char)* (strlen(buf)+1);
    player->location = malloc(sizeof(*player->location)*size);
    assert (player->location != NULL);
    player->location = strcpy(player->location, buf);

    player->npc_relationships = malloc(sizeof(*player->npc_relationships));
    player->npc_relationships->received_100_pioneer = 0;
}

/* Adds default items to inventory -- also tests that adding and removing items from
 * inventory works as expected. Use if new player, not loaded in player
 */
void
new_player(world_t *world, player_t *player){
    printf("Creating you a new player\n");
    Sleep(500);
    printf("-\n");
    Sleep(500);
    printf("-\n");
    /* Name */
    printf("Please enter a player name: ");
    char name[20];
    scanf(" %s", name);
    fflush(stdin);
    printf("%s\n\n", name);
    int size = sizeof(char)* (strlen(name)+1);
    player->name = malloc(sizeof(*player->name)*size);
    assert(player->name != NULL);
    player->name = memcpy(player->name, name, size);
    /* Get the default weapons to be added and add them to inventory */
    weapon_t *new_wep = clone_object(find_weapon(world, STARTING_WEAPON), sizeof(weapon_t));
    assert(new_wep != NULL);
    armour_t *new_arm = clone_object(find_armour(world, STARTING_CHEST), sizeof(armour_t));
    assert(new_arm != NULL);
    player->inventory.add(&player->inventory, new_wep->name, new_wep->datatype, 1, (void*)new_wep);
    player->inventory.add(&player->inventory, new_arm->name, new_arm->datatype, 1, (void*)new_arm);

    /* Equips Default Items to Inventory */
    player->equip(player, new_wep->datatype, (void*)new_wep);
    player->equip(player, new_arm->datatype, (void*)new_arm);
}

/* Player enters a new location in the world  */
static void
enter_location(world_t *world, player_t *player, char* location){
    // Check location exists
    node_t *temp = find_node(world->parent, location);
    assert(temp != NULL && "Location doesn't exist!");

    free(player->location);
    int size = strlen(location)+1;

    // Update their location
    player->location = malloc(sizeof(*player->location)*size);
    assert (player->location != NULL);

    player->location = strcpy(player->location, location);
    printf("--- %s ---\n", player->location);
}

/* Equips a weapon/armour onto the user's apparel. If something is already equipped,
 * it will unequip it and place it in the inventory. Handles the case of an item being
 * passed.
 */
void
equip(player_t *player, char* datatype, void* thing){
    /* Equipping a weapon */
    if(strcmp(datatype, WEAPON) == 0){
        weapon_t *temp = &*(weapon_t *) thing;
        if(temp->level > player->level){
            printf("You tried to equip: %s, but you are level %d and you need "
                   "to be level %d to equip that\n", temp->name, player->level, temp->level);
            return;
        }
        else{
            /* No weapon currently equipped */
            if(player->apparel.equipped_weapon == NULL){
                player->apparel.equipped_weapon = malloc(sizeof(*player->apparel.equipped_weapon));
            }
            /* Weapon currently equipped */
            else{
                unequip(player, player->apparel.equipped_weapon->name);
            }
            player->apparel.equipped_weapon = (weapon_t*)thing;
            strncpy(player->apparel.weapon, player->apparel.equipped_weapon->name, MAX_WEPARM_CHARS);
            player->combat_stats.ar += player->apparel.equipped_weapon->ar;
            player->combat_stats.atk += player->apparel.equipped_weapon->atk;
            player->combat_stats.crit_chance += player->apparel.equipped_weapon->crit_chance;
            player->combat_stats.atk += (temp->upgrade_level * BONUS_ATK_PER_UPG);
            if (temp->upgrade_level > 4){
                player->combat_stats.ar += (temp->upgrade_level - GUARANTEED_UPGRADE_LEVEL);
            }

            /* Adding enchantment effects */
            int i;
            for(i=0; i<player->apparel.equipped_weapon->num_enchantments; i++){
                if (strcmp(player->apparel.equipped_weapon->enchantments[i].type, AR) == 0){
                    player->combat_stats.ar += player->apparel.equipped_weapon->enchantments[i].val;
                }
                else if (strcmp(player->apparel.equipped_weapon->enchantments[i].type, ATK) == 0){
                    player->combat_stats.atk *=  (1+player->apparel.equipped_weapon->enchantments[i].val/100);
                }
                else if (strcmp(player->apparel.equipped_weapon->enchantments[i].type, CRIT) == 0){
                    player->combat_stats.crit_chance *= (1+player->apparel.equipped_weapon->enchantments[i].val/100);
                }
            }

            player->inventory.remove(&player->inventory, temp->name, temp->datatype, 1);
            return;
        }

    }
    /* Equipping armour */
    else if(strcmp(datatype, ARMOUR) == 0){
        armour_t *temp = (armour_t *) thing;
        if(temp->level > player->level){
            printf("You tried to equip: %s, but you are level %d and you need "
                   "to be level %d to equip that\n", temp->name, player->level, temp->level);
            return;
        }
        else {
            /* Armour is boots */
            if(strcmp(temp->type, BOOTS) == 0){
                if(player->apparel.equipped_boots == NULL){
                    player->apparel.equipped_boots = malloc(sizeof(*player->apparel.equipped_boots));
                }
                else{
                player->unequip(player, player->apparel.equipped_boots->name);
                }
                player->apparel.equipped_boots = (armour_t*)thing;
                strncpy(player->apparel.boots, player->apparel.equipped_boots->name, MAX_WEPARM_CHARS);
                player->combat_stats.dr += player->apparel.equipped_boots->dr;
                player->combat_stats.def += player->apparel.equipped_boots->def;
                return;
            }
            /* Armour is gloves */
            else if (strcmp(temp->type, GLOVES) == 0){
                if(player->apparel.equipped_gloves == NULL){
                    player->apparel.equipped_gloves = malloc(sizeof(*player->apparel.equipped_gloves));
                }
                else{
                player->unequip(player, player->apparel.equipped_gloves->name);
                }
                player->apparel.equipped_gloves = (armour_t*)thing;
                strncpy(player->apparel.gloves, player->apparel.equipped_gloves->name, MAX_WEPARM_CHARS);
                player->combat_stats.dr += player->apparel.equipped_gloves->dr;
                player->combat_stats.def += player->apparel.equipped_gloves->def;
                return;
            }
            /* Since the largest variety is chest armour, if it is not the above, it is chest */
            else {
                if(player->apparel.equipped_chest == NULL){
                    player->apparel.equipped_chest = malloc(sizeof(*player->apparel.equipped_chest));
                }
                else{
                player->unequip(player, player->apparel.equipped_chest->name);
                }
                player->apparel.equipped_chest = (armour_t*)thing;
                strncpy(player->apparel.chest, player->apparel.equipped_chest->name, MAX_WEPARM_CHARS);
                player->combat_stats.dr += player->apparel.equipped_chest->dr;
                player->combat_stats.def += player->apparel.equipped_chest->def;
                player->combat_stats.def += (temp->upgrade_level * BONUS_DEF_PER_UPG);
                if (temp->upgrade_level > 4){
                    player->combat_stats.dr += (temp->upgrade_level - GUARANTEED_UPGRADE_LEVEL);
                }

                /* Adding enchantment effects */
                int i;
                for(i=0; i<player->apparel.equipped_chest->num_enchantments; i++){
                    if (strcmp(player->apparel.equipped_chest->enchantments[i].type, DR) == 0){
                        player->combat_stats.dr += player->apparel.equipped_chest->enchantments[i].val;
                    }
                    else if (strcmp(player->apparel.equipped_chest->enchantments[i].type, DEF) == 0){
                        player->combat_stats.def +=  player->apparel.equipped_chest->enchantments[i].val;
                    }
                    else if (strcmp(player->apparel.equipped_chest->enchantments[i].type, EVA) == 0){
                        player->combat_stats.evasion += player->apparel.equipped_chest->enchantments[i].val;
                    }
                    else if (strcmp(player->apparel.equipped_chest->enchantments[i].type, HP) == 0){
                        int old_hp_bonus = player->combat_stats.hp_bonus;
                        player->combat_stats.hp_bonus = ((player->combat_stats.max_hp - old_hp_bonus)/100)*player->apparel.equipped_chest->enchantments[i].val;
                        player->combat_stats.max_hp += old_hp_bonus + player->combat_stats.hp_bonus;
                    }
                }
                player->inventory.remove(&player->inventory, temp->name, temp->datatype, 1);
                return;
            }
        }
    }
    else if (strcmp(datatype, ITEM) == 0){
        fprintf(stdout, "You can't equip an item!\n");
        return;
    }
    else{
        fprintf(stderr, "Error with datatype: Type: %s",datatype);
        assert(0 && "Problem with datatype");

    }
}

/* Unequips a weapon/armour from the player's apparel, and puts it in the player's
 * inventory. Handles the case where weapon/armour is not equipped.
 */
void
unequip(player_t *player, char* name){

    /* Unequip Chest*/
    if (strcmp(name, player->apparel.chest) == 0){
        assert(player->apparel.equipped_chest != NULL);
        player->combat_stats.dr -= player->apparel.equipped_chest->dr;
        player->combat_stats.def -= player->apparel.equipped_chest->def;
        player->combat_stats.def -= (player->apparel.equipped_chest->upgrade_level * BONUS_DEF_PER_UPG);
        if (player->apparel.equipped_chest->upgrade_level > 4){
            player->combat_stats.dr -= (player->apparel.equipped_chest->upgrade_level - GUARANTEED_UPGRADE_LEVEL);
        }
        // TODO
        /* Removing enchantment effects */
        int i;
        for(i=0; i<player->apparel.equipped_chest->num_enchantments; i++){
            if (strcmp(player->apparel.equipped_chest->enchantments[i].type, DR) == 0){
                player->combat_stats.dr -= player->apparel.equipped_chest->enchantments[i].val;
            }
            else if (strcmp(player->apparel.equipped_chest->enchantments[i].type, DEF) == 0){
                player->combat_stats.def -=  player->apparel.equipped_chest->enchantments[i].val;
            }
            else if (strcmp(player->apparel.equipped_chest->enchantments[i].type, EVA) == 0){
                player->combat_stats.evasion -= player->apparel.equipped_chest->enchantments[i].val;
            }
            else if (strcmp(player->apparel.equipped_chest->enchantments[i].type, HP) == 0){
                int initial_hp = (player->combat_stats.max_hp - player->combat_stats.hp_bonus);
                int subtract = initial_hp*(player->apparel.equipped_chest->enchantments[i].val/100.0);
                player->combat_stats.hp_bonus -= subtract;
                assert(player->combat_stats.hp_bonus >= 0);
                player->combat_stats.max_hp = initial_hp + player->combat_stats.hp_bonus;
                if (player->combat_stats.cur_hp > player->combat_stats.max_hp){
                    player->combat_stats.cur_hp -= player->combat_stats.max_hp;
                }
            }

        }

        player->inventory.add(&player->inventory, player->apparel.chest, ARMOUR, 1, (void*)player->apparel.equipped_chest);
        strcpy(player->apparel.chest, NOTHING_EQUIPPED);
        player->apparel.equipped_chest = NULL;
    }
    /* Unequip Weapon*/
    else if (strcmp(name, player->apparel.weapon) == 0){
        assert(player->apparel.equipped_weapon != NULL);
        player->combat_stats.ar -= player->apparel.equipped_weapon->ar;
        player->combat_stats.atk -= player->apparel.equipped_weapon->atk;
        player->combat_stats.crit_chance -= player->apparel.equipped_weapon->crit_chance;
        player->combat_stats.atk -= (player->apparel.equipped_weapon->upgrade_level * BONUS_ATK_PER_UPG);
        if (player->apparel.equipped_chest->upgrade_level > 4){
            player->combat_stats.ar -= (player->apparel.equipped_weapon->upgrade_level - GUARANTEED_UPGRADE_LEVEL);
        }

        /* Removing enchantment effects */
        int i;
        for(i=0; i<player->apparel.equipped_weapon->num_enchantments; i++){
            if (strcmp(player->apparel.equipped_weapon->enchantments[i].type, AR) == 0){
                player->combat_stats.ar -= player->apparel.equipped_weapon->enchantments[i].val;
            }
            else if (strcmp(player->apparel.equipped_weapon->enchantments[i].type, ATK) == 0){
                player->combat_stats.atk /=  (1+player->apparel.equipped_weapon->enchantments[i].val/100);
            }
            else if (strcmp(player->apparel.equipped_weapon->enchantments[i].type, CRIT) == 0){
                player->combat_stats.crit_chance /= (1+player->apparel.equipped_weapon->enchantments[i].val/100);
            }
        }

        player->inventory.add(&player->inventory, player->apparel.weapon, WEAPON, 1, (void*)player->apparel.equipped_weapon);
        strcpy(player->apparel.weapon, NOTHING_EQUIPPED);
        player->apparel.equipped_weapon = NULL;
    }
    /* Unequip Gloves*/
    else if (strcmp(name, player->apparel.gloves) == 0){
        assert(player->apparel.equipped_gloves != NULL);
        player->combat_stats.dr -= player->apparel.equipped_gloves->dr;
        player->combat_stats.def -= player->apparel.equipped_gloves->def;
        player->inventory.add(&player->inventory, player->apparel.gloves, ARMOUR, 1, (void*)player->apparel.equipped_gloves);
        strcpy(player->apparel.gloves, NOTHING_EQUIPPED);
        player->apparel.equipped_gloves = NULL;
    }

    /* Unequip Boots*/
    else if (strcmp(name, player->apparel.boots) == 0){
        assert(player->apparel.equipped_boots != NULL);
        player->combat_stats.dr -= player->apparel.equipped_boots->dr;
        player->combat_stats.def -= player->apparel.equipped_boots->def;
        player->inventory.add(&player->inventory, player->apparel.boots, ARMOUR, 1, (void*)player->apparel.equipped_boots);
        strcpy(player->apparel.boots, NOTHING_EQUIPPED);
        player->apparel.equipped_boots = NULL;
    }
    else{
        fprintf(stdout, "You've tried to unequip %s, but it isn't equipped\n", name);
        return;
    }
}

/* Prints basic player information to stdout */
static void
print_player_info(player_t *player){
    printf("\n%s %s's Information %s\n", PLAYER_INFO_SEPARATOR, player->name, PLAYER_INFO_SEPARATOR);
    printf("Name:               %s\n", player->name);
    printf("Vis:                %d\n", player->vis);
    printf("Items in Inventory: %d\n", player->inventory.num_objects);
    printf("Level:              %d\n", player->level);
    printf("Experience:         %d\n", player->experience);
    printf("Location:           %s\n", player->location);
    printf("%s========================%s\n", PLAYER_INFO_SEPARATOR, PLAYER_INFO_SEPARATOR);
}

/* Prints player's apparel to stdout */
static void
display_apparel(player_t *player){
    print_apparel(&player->apparel);
}

/* Prints player's combat stats to stdout */
static void
display_combat_stats(player_t *player){
    printf("\n===%s's Combat Stats===\n", player->name);
    print_combat_stats(&player->combat_stats);
    printf("%s==============\n", PLAYER_INFO_SEPARATOR);
}

/* Adds monster to a location */
static void
add_monster_to_location(world_t *world, monster_t *monster, char* loc_name){
    node_t *temp = find_node(world->parent, loc_name);
    if (temp == NULL){
        fprintf(stderr, "Tried to find location: %s which does not exist\n", loc_name);
        assert(0);
    }

    int n = temp->info.num_monsters;

    if (n == temp->info.monsters_alloclen){
        temp->info.monsters_alloclen *= 2;
        temp->info.monsters = realloc(temp->info.monsters, sizeof(monster_t) * temp->info.monsters_alloclen);

    }
    temp->info.monsters[temp->info.num_monsters++] = *monster;
}

/* Free all dynamically allocated information in player */
void
free_player(player_t *player){
    free(player->name);
    free(player->location);
    free_apparel(&player->apparel);
    free_inventory(&player->inventory);
    free(player->npc_relationships);
}

/*****************************************************************************/
/**************************** Inventory Functions ****************************/
/*****************************************************************************/

/* Empty Inventory created -- player's inventory is empty */
void
create_inventory(inventory_t *inventory){
    assert(inventory != NULL);
    inventory->first_slot = NULL;
    inventory->num_armour = 0;
    inventory->num_items = 0;
    inventory->num_objects = 0;
    inventory->num_weapons = 0;
    inventory->value_inventory = 0;

    inventory->add = &add_to_inventory;
    inventory->remove = &remove_from_inventory;
    inventory->find = &find_from_inventory;
}


/* Adds object to inventory */
void
add_to_inventory(inventory_t *inventory, char* name, char* datatype, int quantity, void* thing){
    slot_t *new_thing;
    new_thing = malloc(sizeof(*new_thing));
    assert(inventory != NULL && new_thing != NULL);


    new_thing->name = malloc(sizeof(*name) * (strlen(name) + 1));
    strcpy(new_thing->name, name);
    new_thing->datatype = malloc(sizeof(*datatype) * (strlen(datatype) + 1));
    strcpy(new_thing->datatype, datatype);
    new_thing->quantity = 1;        // Weapons and Armour can only be inserted one at a time
    if (strcmp(datatype, WEAPON) == 0){
        new_thing->item = malloc(sizeof(weapon_t));
        inventory->num_weapons++;
        inventory->num_objects++;
        weapon_t temp = *((weapon_t *) thing);
        inventory->value_inventory += temp.val;
    }
    else if (strcmp(datatype, ARMOUR) == 0){
        new_thing->item = malloc(sizeof(armour_t));
        inventory->num_armour++;
        inventory->num_objects++;
        armour_t temp = *((armour_t *) thing);
        inventory->value_inventory += temp.val;
    }
    else if (strcmp(datatype, ITEM) == 0){
        new_thing->item = malloc(sizeof(item_t));
        inventory->num_items++;
        inventory->num_objects++;
        new_thing->quantity = quantity; // Items can be duplicates, so a quantity of >1 makes sense
        item_t temp = *((item_t *) thing);
        inventory->value_inventory += (temp.val*quantity);
    }
    else {
        assert(0 && "Trying to add a non game object into inventory.");
    }
    new_thing->item = thing;
    new_thing->next = NULL;
    if (inventory->first_slot == NULL){
        inventory->first_slot = new_thing;
        return;
    }
    /* Stack-like, first into list is on the bottom.
     * new_thing is pushed to the first slot of the inventory
     */

    slot_t* temp = inventory->first_slot;
    while(temp->next != NULL){
        temp = temp->next;
    }
    temp->next = new_thing;
}

/* Removes object from inventory and returns a void pointer to the object */
void*
remove_from_inventory(inventory_t *inventory, char* name, char* datatype, int quantity){
    assert(inventory != NULL);
    if(inventory->first_slot == NULL){
        fprintf(stderr, "Cannot remove %s from an empty inventory\n", name);
        assert(0 && "Inventory empty, can't remove from it");
    }
    slot_t *to_return = NULL; // We will actually return the item in this inventory slot
    slot_t *curr = inventory->first_slot;
    slot_t *prev = NULL;
    /* Traverse list, returning pointer to object that matches name
     * unlinks object from list, and relinks list
     */
    while(curr != NULL){
        if (strcmp(curr->name, name) == 0){
            to_return = curr;
            /* First object in list */
            if(prev == NULL){
                inventory->first_slot = inventory->first_slot->next;
                break;
            }
            prev->next = curr->next;
            break;
        }
        prev = curr;
        curr = curr->next;
    }
    inventory->num_objects--;

    /* Adjusts value of inventory before returning object removed */
    if(strcmp(datatype, WEAPON) == 0){
        inventory->num_weapons--;
        weapon_t *temp = ((weapon_t *) to_return->item);
        inventory->value_inventory -= temp->val;
    }
    else if(strcmp(datatype, ARMOUR) == 0){
        inventory->num_armour--;
        armour_t *temp = ((armour_t *) to_return->item);
        inventory->value_inventory -= temp->val;
    }
    else if (strcmp(datatype, ITEM) == 0){
        inventory->num_items--;
        item_t *temp = ((item_t *) to_return->item);
        inventory->value_inventory -= temp->val;
    }
    else{
        fprintf(stderr, "Error with datatype: Name: %s, Type: %s", name, datatype);
        assert(0 && "Problem with datatype");
    }
    curr = to_return;
    void* returning = to_return->item;
    free(curr->next);
    return returning;
}

/* Returns pointer to inventory slot, and NULL if
 * object name not in inventory
 */
slot_t*
find_from_inventory(inventory_t *inventory, char* name){
    assert(inventory != NULL);
    if(inventory->first_slot == NULL){
        return NULL;
    }
    slot_t *to_return = NULL;
    slot_t *curr = inventory->first_slot;
    /* Traverse list, returns the inventory slot */
    while(curr != NULL){
        if (strcmp(curr->name, name) == 0){
            to_return = curr;
            break;
        }
        curr = curr->next;
    }
    return to_return;
}

void
increase_item_quantity(inventory_t *inventory, char* name, int quant){
    slot_t* found_item = find_from_inventory(inventory, name);
    assert(found_item != NULL);
    if (found_item->quantity + quant > MAX_INVENTORY_ITEM_QUANT){
        printf("Cannot have more than %d of %s in your inventory\n", MAX_INVENTORY_ITEM_QUANT, name);
        return;
    }
    found_item->quantity += quant;
    inventory->value_inventory += (quant*((item_t*)found_item->item)->val);
}

/* Places into array, names of all objects in inventory, returning number of objects */
int
inventory_to_array(inventory_t *inventory, char A[][MAX_CITY_CHARS+1]){
    int i = 0;
    assert(inventory != NULL);
    slot_t *curr = inventory->first_slot;
    while (curr != NULL){
        strcpy(A[i++], curr->name);
        curr = curr->next;
    }
    return i;
}

void
free_inventory(inventory_t *inventory){
    slot_t* curr = NULL;
    slot_t* prev = NULL;
    curr = inventory->first_slot;
    while (curr != NULL){
        free(curr->datatype);
        free(curr->name);
        free(curr->item);
        prev = curr;
        curr = curr->next;
        free(prev);
    }
    free(curr);
}

/* Prints inventory */
static void
print_inventory(inventory_t *inventory){
    printf("\n%s Your Inventory %s\n", INVENTORY_SEPARATOR, INVENTORY_SEPARATOR);
    printf("Number of things in Inventory: %d\n", inventory->num_objects);
    printf("Value of Inventory: %d\n", inventory->value_inventory);
    int i = 1;
    slot_t *temp = inventory->first_slot;
    if (inventory->num_objects == 0){
        printf("Inventory is empty!\n");
        return;
    }

    int val;
    char* type;
    int level = 0;
    int upgrade_level = 0;
    while(temp != NULL){
        if (strcmp(temp->datatype, WEAPON) == 0){
            weapon_t data = *((weapon_t *) temp->item);
            val = data.val;
            type = malloc(sizeof(*type)* strlen(data.type)+1);
            assert(type != NULL);
            strcpy(type, data.type);
            level = data.level;
            upgrade_level = data.upgrade_level;
        }
        else if (strcmp(temp->datatype, ARMOUR) == 0){
            armour_t data = *((armour_t *) temp->item);
            val = data.val;
            type = malloc(sizeof(*type)* strlen(data.type)+1);
            assert(type != NULL);
            strcpy(type, data.type);
            level = data.level;
            upgrade_level = data.upgrade_level;
        }
        else if (strcmp(temp->datatype, ITEM) == 0){
            item_t data = *((item_t *) temp->item);
            val = data.val;
            type = malloc(sizeof(*type)* strlen(data.type)+1);
            assert(type != NULL);
            strcpy(type, data.type);
        }
        if(i == 1){
            printf("\t    %28s %7s %10s %10s %20s %15s\n",
                   "Item Name", "Level", "Quantity", "Class", "Type", "Vis Value");
        }
        if (upgrade_level > 0){
            char trial[MAX_CITY_CHARS+1+10];
            unsigned int pointer_magic = ASCII_0 + upgrade_level;
            trial[0] = '+';
            /* I am pretty sure this is endian specific, if there is a bug then the wrong bits are being copied*/
            strcpy(trial+1, ((char*)&pointer_magic));
            strcat(trial, " ");
            strcat(trial, temp->name);
            printf("\t(%2d) %28s %7d %10d %10s %20s %15d\n",
                   i++, trial, level, temp->quantity, temp->datatype, type, val);
        }
        else {
            printf("\t(%2d) %28s %7d %10d %10s %20s %15d\n",
                       i++, temp->name, level, temp->quantity, temp->datatype, type, val);
        }
        temp = temp->next;
        upgrade_level = 0;
    }
    printf("%s================%s\n", INVENTORY_SEPARATOR, INVENTORY_SEPARATOR);
    free(type);
}


/*****************************************************************************/
/***************************** Weapon Functions ******************************/
/*****************************************************************************/

/* Populate weapon with information */
void
create_weapon(weapon_t *weapon, char* name, char* type, int level, int ar,
              int atk, int val){
    weapon->name = malloc(sizeof(*weapon->name) * (strlen(name)+1));
    assert(weapon->name != NULL);
    strcpy(weapon->name, name);
    weapon->level = level;

    weapon->datatype = malloc(sizeof(*weapon->datatype) * strlen(WEAPON)+1);
    assert(weapon->datatype != NULL);
    strcpy(weapon->datatype, WEAPON);

    weapon->type = malloc(sizeof(*weapon->type) * strlen(type)+1);
    assert(weapon->type != NULL);
    strcpy(weapon->type, type);

    weapon->ar = ar;
    weapon->atk = atk;
    weapon->crit_chance = 0;
    weapon->val = val;
    weapon->equipped = 0;
    weapon->upgrade_level = 0;

    int i;
    for(i=0; i<MAX_ENHANCEMENTS; i++){
        weapon->enchantments[i].type = NULL;
        weapon->enchantments[i].val = 0;
    }
    weapon->num_enchantments = 0;

    weapon->print_weapon = &print_weapon;;
}

/* Returns pointer to default weapons in world, and NULL if
 * name not a default weapon
 */
weapon_t*
find_weapon(world_t *world, char* weapon_name){
    int i;
    for(i=0; i<world->num_weapons; i++){
        if (strcmp(world->weapons[i].name, weapon_name) == 0){
            return &world->weapons[i];
        }
    }
    return NULL;
}

/* Prints weapon to stdout */
static void
print_weapon(weapon_t *weapon){
    printf("Weapon Name:  ");
    if(weapon->upgrade_level >0){
        printf("+%d %s\n", weapon->upgrade_level, weapon->name);
    }
    else{
        printf("%s\n", weapon->name);
    }
    printf("Weapon Type:  %s\n", weapon->type);
    printf("Weapon Level: %d\n", weapon->level);
    printf("Weapon AR:    %d\n", weapon->ar);
    printf("Weapon Atk:   %d\n", weapon->atk);
    printf("Weapon Val:   %d\n", weapon->val);

    int i;
    if (weapon->num_enchantments>0){
        printf("Enchantments:\n");
        for(i=0; i<weapon->num_enchantments; i++){
            if (strcmp(weapon->enchantments[i].type, "AR") == 0){
                printf("\t+%d %s\n", weapon->enchantments[i].val, weapon->enchantments[i].type);
            }
            else{
                printf("\t+%d%% %s\n", weapon->enchantments[i].val, weapon->enchantments[i].type);
            }
        }
    }

    printf("\n");
}

/* Free all dynamically allocated memory in weapon */
void
free_weapon(weapon_t *weapon){
    printf("Attempting to free: %s\n", weapon->name);
    free(weapon->name);
    free(weapon->type);
    free(weapon->datatype);
    int i;
    for(i=0; i<weapon->num_enchantments; i++){
        free(weapon->enchantments[i].type);
    }
}

/*****************************************************************************/
/***************************** Armour Functions ******************************/
/*****************************************************************************/

/* Populate armour with information */
void
create_armour(armour_t *armour, char* name, char* type, int level, int dr,
              int def, int val){
    armour->name = malloc(sizeof(*armour->name) * (strlen(name)+1));
    strcpy(armour->name, name);
    armour->level = level;

    armour->datatype = malloc(sizeof(*armour->datatype) * strlen(ARMOUR)+1);
    strcpy(armour->datatype, ARMOUR);

    armour->type = malloc(sizeof(*armour->type) * (strlen(type)+1));
    strcpy(armour->type, type);

    armour->dr = dr;
    armour->def = def;
    armour->evasion = 0;
    armour->hp_bonus = 0;
    armour->val = val;
    armour->equipped = 0;
    armour->upgrade_level = 0;

    armour->print_armour = &print_armour;

    int i;
    for(i=0; i<MAX_ENHANCEMENTS; i++){
        armour->enchantments[i].type = NULL;
        armour->enchantments[i].val = 0;
    }
    armour->num_enchantments = 0;
}

/* Returns pointer to default armour in world, and NULL if
 * name not a default armour
 */
armour_t*
find_armour(world_t *world, char* armour_name){
    int i;
    for(i=0; i<world->num_armour; i++){
        if (mystrcasestr(world->armours[i].name, armour_name) != NULL){
            return &world->armours[i];
        }
    }
    return NULL;
}

item_t*
find_item(world_t *world, char* item_name){
    int i;
    for(i=0; i<world->num_items; i++){
        if (strcasecmp(world->items[i].name, item_name) == 0){
            return &world->items[i];
        }
    }
    return NULL;
}

/* Prints armour to stdout */
static void
print_armour(armour_t *armour){
    printf("Armour Name:  %s\n", armour->name);
    printf("Armour Type:  %s\n", armour->type);
    printf("Armour Level: %d\n", armour->level);
    printf("Armour DR:    %d\n", armour->dr);
    printf("Armour DEF:   %d\n", armour->def);
    printf("Armour Val:   %d\n", armour->val);
    printf("\n");

    int i;
    if (armour->num_enchantments>0){
        printf("Enchantments:\n");
        for(i=0; i<armour->num_enchantments; i++){
            if (strcmp(armour->enchantments[i].type, HP) == 0){
                printf("\t+%d%% %s\n", armour->enchantments[i].val, armour->enchantments[i].type);
            }
            else{
                printf("\t+%d %s\n", armour->enchantments[i].val, armour->enchantments[i].type);

            }
        }
    }
}

/* Free all dynamically allocated memory in armour */
void
free_armour(armour_t *armour){
    free(armour->name);
    free(armour->type);
    free(armour->datatype);
    int i;
    for(i=0; i<armour->num_enchantments; i++){
        free(armour->enchantments[i].type);
    }
}

/*****************************************************************************/
/****************************** Item Functions *******************************/
/*****************************************************************************/

/* Populate item with information */
void
create_item (item_t *item, char* name, char* type, int val, char* description){
    item->name = malloc(sizeof(*item->name) * (strlen(name)+1));
    assert(item->name != NULL);
    strcpy(item->name, name);

    item->datatype = malloc(sizeof(*item->datatype) * strlen(ITEM)+1);
    assert(item->datatype != NULL);
    strcpy(item->datatype, ITEM);

    item->type = malloc(sizeof(*item->type) * (strlen(type)+1));
    assert(item->type != NULL);
    strcpy(item->type, type);

    item->val = val;

    item->description = malloc(sizeof(*item->description) * (strlen(description)+1));
    assert(item->description != NULL);
    strcpy(item->description, description);
}

/* Prints item to stdout */
void
print_item(item_t *item){
    printf("Item Name:  %s\n", item->name);
    printf("Item Type:  %s\n", item->type);
    printf("Item Value: %d\n", item->val);
    printf("Item Description:\n\t%s\n", item->description);
    printf("\n");
}

/* Free all dynamically allocated memory in item */
void
free_item(item_t *item){
    printf("Attempting to free: %s\n", item->name);
    free(item->name);
    free(item->type);
    free(item->datatype);
    free(item->description);
}
/*****************************************************************************/
/***************************** Apparel Functions *****************************/
/*****************************************************************************/

/* Empty Apparel created -- player has nothing equipped */
void
create_apparel(apparel_t *apparel){
    assert(apparel != NULL);
    apparel->weapon = malloc(sizeof(*apparel->weapon) *(MAX_WEPARM_CHARS+1));
    apparel->gloves = malloc(sizeof(*apparel->gloves) *(MAX_WEPARM_CHARS+1));
    apparel->chest = malloc(sizeof(*apparel->chest) *(MAX_WEPARM_CHARS+1));
    apparel->boots = malloc(sizeof(*apparel->boots) *(MAX_WEPARM_CHARS+1));
    assert(apparel->weapon != NULL && apparel->gloves != NULL
           && apparel->chest != NULL && apparel->boots != NULL);

    strcpy(apparel->weapon, NOTHING_EQUIPPED);
    strcpy(apparel->gloves, NOTHING_EQUIPPED);
    strcpy(apparel->chest, NOTHING_EQUIPPED);
    strcpy(apparel->boots, NOTHING_EQUIPPED);

    /* On first equipment they should be malloced */
    apparel->equipped_weapon = NULL;
    apparel->equipped_gloves = NULL;
    apparel->equipped_chest = NULL;
    apparel->equipped_boots = NULL;

    apparel->print_apparel = &print_apparel;
}

/* Prints apparel to stdout */
static void
print_apparel(apparel_t *apparel){
    printf("\n%s What you are wearing%s\n",SEPARATOR, SEPARATOR);
    printf("Weapon:    %s\n", apparel->weapon);
    printf("Chest:     %s\n", apparel->chest);
    printf("Gloves:    %s\n", apparel->gloves);
    printf("Boots:     %s\n", apparel->boots);
}


/* Frees all dynamically allocated information in apparel to heap */
void
free_apparel(apparel_t *apparel){
    free(apparel->chest);
    free(apparel->equipped_chest);
    free(apparel->gloves);
    free(apparel->equipped_gloves);
    free(apparel->boots);
    free(apparel->equipped_boots);
    free(apparel->weapon);
    free(apparel->equipped_weapon);
}

/*****************************************************************************/
/*************************** Combat Stats Functions **************************/
/*****************************************************************************/
/* Default combat stats created for level 1 player */
void
create_combat_stats (combat_stats_t *combat_stats){
    assert(combat_stats != NULL);
    combat_stats->max_hp = LEVEL_1_HEALTH + (HP_PER_LVL*(STARTING_LEVEL-1));
    combat_stats->cur_hp = combat_stats->max_hp;
    combat_stats->ar = STARTING_LEVEL/4;
    combat_stats->atk = 0;
    combat_stats->crit_chance = 0;
    combat_stats->dr = STARTING_LEVEL/4;
    combat_stats->def = 0;
    combat_stats->evasion = 0;
    combat_stats->hp_bonus = 0;
    combat_stats->ardr_level_bonus = 0;
}

/* Prints players combat stats to stdout */
static void
print_combat_stats(combat_stats_t *combat_stats){
    printf("Health:   %d/%d\n", combat_stats->cur_hp, combat_stats->max_hp);
    printf("AR:       %d\n", combat_stats->ar);
    printf("Attack:   %d\n", combat_stats->atk);
    printf("Crit %%:  %d\n", combat_stats->crit_chance);
    printf("DR:       %d\n", combat_stats->dr);
    printf("Def       %d\n", combat_stats->def);
    printf("Evasion:  %d\n", combat_stats->evasion);
    printf("Bonus HP: %d\n", combat_stats->hp_bonus);
}

/*****************************************************************************/
/***************************** Monster Functions *****************************/
/*****************************************************************************/

/* Populates monster with information */
void
create_monster(monster_t *monster, char* name, char habitat[][MAX_CITY_CHARS+1],
               int num_habitat, int level, int hp, unsigned int exp, int aspd,
               int hits_per_attack, int atk, int ar, int def, int dr,
               int fire_res, int ice_res, int lightning_res, int mental_res,
               char loot_drops[][MAX_WEPARM_CHARS+1], int n){

    monster->level = level;
    monster->name = malloc(sizeof(*monster->name) * (strlen(name)+1));
    strcpy(monster->name, name);
    int i;
    for(i=0; i<num_habitat; i++){
        strcpy(monster->native_to[i], habitat[i]);
    }
    monster->locations_inhabited = num_habitat;
    monster->hp = hp;
    monster->exp = exp;
    monster->aspd = aspd;
    monster->hits_per_attack = hits_per_attack;
    monster->atk = atk;
    monster->ar = ar;
    monster->def = def;
    monster->dr = dr;
    monster->fire_res = fire_res;
    monster->ice_res = ice_res;
    monster->lightning_res = lightning_res;
    monster->mental_res = mental_res;


    monster->drop_list = malloc(sizeof(*monster->drop_list) * n);
    monster->drops_alloc = n;
    monster->num_drops = 0;
    int j;

    for(j=0; j<n; j++){
        monster->drop_list[j] = malloc(sizeof(*loot_drops[j]) * ((int)strlen(loot_drops[j]+1)));
        strcpy(monster->drop_list[j], loot_drops[j]);
    }
    monster->num_drops = n;



    monster->print_monster = &print_monster;

    {char temp[] = "Elite";
    if (memcmp(name, temp, sizeof(char)*((int)strlen(temp))) == 0){
        monster->elite = TRUE;
    }
    else{
        monster->elite = FALSE;
    }
    }
    char temp[] = "(Boss)";
    if (memcmp(name+strlen(name)-strlen(temp), temp, (int)strlen(temp)) == 0){
        monster->boss = TRUE;
    }
    else{
        monster->boss = FALSE;
    }
}

/* Prints monsters to stdout */
static void
print_monster(monster_t *monster){
    int j;
    printf("%s%s\n",SEPARATOR, SEPARATOR);
    printf("Name: %s (Lvl %d)\n", monster->name, monster->level);
    printf("Locations Inhabited:\n");
    for(j=0; j<monster->locations_inhabited; j++){
        /* Last location inhabited */
        if (j+1 == monster->locations_inhabited){
            /*Full stop sinceS last location */
            printf("\t%s.\n", monster->native_to[j]);
        }
        else{
            printf("\t%s;\n", monster->native_to[j]);
        }
    }
    printf("\n");
    printf("HP:              %8d Def: %d\n", monster->hp, monster->def);
    printf("EXP:             %8u DR: %d\n", monster->exp, monster->dr);
    printf("ASPD:            %8d Fire Res: %d\n", monster->aspd, monster->fire_res);
    printf("Hits per Attack: %8d Ice Res: %d\n", monster->hits_per_attack, monster->ice_res);
    printf("Attack:          %8d Lightning Res: %d\n", monster->atk, monster->lightning_res);
    printf("AR:              %8d Mental Res: %d\n", monster->ar, monster->mental_res);
    printf("Boss: %d\n", monster->boss);
    printf("Drops:\n");
    for(j=0; j<monster->num_drops; j++){
        printf("\t%s\n", monster->drop_list[j]);
    }
    printf("%s%s\n", SEPARATOR, SEPARATOR);

}

/* Frees all dynamically allocated information in monster to heap */
void
free_monster(monster_t *monster){
    free(monster->name);
    int i;
    for(i=0; i<monster->num_drops; i++){
        free(monster->drop_list[i]);
    }
    free(monster->drop_list);
}

/*****************************************************************************/
/******************************* NPC Functions *******************************/
/*****************************************************************************/


/* Populates npc with information */
void
create_npc(npc_t *npc, char* name, char* shop_type, char* merchandise_type,
           char actions[][MAX_CITY_CHARS+1], int num_actions){
    npc->name = malloc(sizeof(*npc->name) * (strlen(name)+1));
    assert(npc->name != NULL);
    strcpy(npc->name, name);

    npc->shop_type = malloc(sizeof(*npc->shop_type) * (strlen(shop_type)+1));
    assert (npc->shop_type != NULL);
    strcpy(npc->shop_type, shop_type);

    npc->merchandise_type = malloc(sizeof(*npc->merchandise_type) * (strlen(merchandise_type)+1));
    assert(npc->merchandise_type != NULL);
    strcpy(npc->merchandise_type, merchandise_type);

    npc->level = 0;

    int i;
    for(i=0; i<num_actions; i++){
        strcpy(npc->actions[i], actions[i]);
    }
    npc->num_actions = num_actions;

    npc->num_dialogue = 0;
    npc->alloc_dialogue = INIT_ALLOC;
    npc->dialogue = malloc(sizeof(*npc->dialogue) * npc->alloc_dialogue);
    assert(npc->dialogue != NULL);
}

void
print_npc(npc_t *npc){
    printf("Name: %s\n", npc->name);
    printf("Shop Type: %s\n",npc->shop_type);
    printf("Merchandise Type: %s\n", npc->merchandise_type);
    printf("Actions:\n");
    int i;
    for(i=0; i<npc->num_actions; i++){
        printf("\t(%d) %s\n", i, npc->actions[i]);
    }
}

/* Frees all dynamically allocated information in npc to heap */
void
free_npc(npc_t *npc){
    free(npc->name);
    free(npc->shop_type);
    free(npc->merchandise_type);
    free(npc->actions);
    free(npc->dialogue);
}

/*****************************************************************************/
/*************************** Dictionary Functions ****************************/
/*****************************************************************************/

/* ELF Hash Function -- http://www.partow.net/programming/hashfunctions*/
unsigned int ELFHash(const char* str, unsigned int length){
   unsigned int hash = 0;
   unsigned int x    = 0;
   unsigned int i    = 0;

   for (i = 0; i < length; ++str, ++i){
      hash = (hash << 4) + (*str);
      if ((x = hash & 0xF0000000L) != 0){
         hash ^= (x >> 24);
      }
      hash &= ~x;
   }
   return hash % HASH_TABLE_SIZE;
}

/* Creates hashtable to store loot drop rates */
void
create_hashtable(hashtable_t *table, unsigned int table_size){
    table->table_size = table_size;

    table->buckets = malloc(sizeof(*table->buckets)*table_size);
    assert(table->buckets != NULL);


    int i;
    /* Make each bucket 'empty' */
    for(i=0; i<table_size; i++){
        table->buckets[i].bucket_limit = 1;
        table->buckets[i].bucket_size = 0;
        table->buckets[i].loot = NULL;
    }
}

/* Adds loot to dictionary */
void
dict_add(hashtable_t *table, char* key, int rarity){
    unsigned int hash_index = ELFHash(key, (unsigned int)strlen(key));
    int bucket_size = table->buckets[hash_index].bucket_size;
    int bucket_limit = table->buckets[hash_index].bucket_limit;
    /* First key hashing to this value */
    if (bucket_size == 0){
        table->buckets[hash_index].loot = malloc(sizeof(*table->buckets[hash_index].loot)*bucket_limit);
        assert(table->buckets[hash_index].loot != NULL);
    }
    /* Colission + realloc memory */
    if (bucket_limit == bucket_size){
        table->buckets[hash_index].bucket_limit *= 2;
        table->buckets[hash_index].loot = realloc(table->buckets[hash_index].loot, sizeof(*table->buckets[hash_index].loot)*bucket_limit);
        assert(table->buckets[hash_index].loot != NULL);
    }
    table->buckets[hash_index].loot[bucket_size].loot_name = malloc(sizeof(char)*((int)strlen(key)+1));
    strcpy(table->buckets[hash_index].loot[bucket_size].loot_name, key); // Problematic
    table->buckets[hash_index].loot[bucket_size].rarity = rarity;

    table->buckets[hash_index].bucket_size++;
}

/* Searches for loot in dictionary, returning pointer to loot or NULL */
loot_t*
dict_search(hashtable_t *table, char* key){
    unsigned int hash_index = ELFHash(key, (unsigned int)strlen(key));
    int i;
    for(i=0; i<table->buckets[hash_index].bucket_size; i++){
        if (strcmp(table->buckets[hash_index].loot[i].loot_name, key) == 0){
            return &table->buckets[hash_index].loot[i];
        }
    }
    return NULL;
}

void
print_dict(hashtable_t *table){
    int i, j;
    for(i=0; i<table->table_size; i++){
        if (table->buckets[i].bucket_size == 0){
            continue;
        }
        for(j=0; j<table->buckets[i].bucket_size; j++){
            printf("Hash Value: %i, Bucket No: %d, Object: %s\n", i, j, table->buckets[i].loot[j].loot_name);
        }
    }
}

void
free_dict(hashtable_t *table){
    int i, j;
    for(i=0; i<table->table_size; i++){
        if (table->buckets[i].bucket_size != 0){
            for(j=0; j<table->buckets[i].bucket_size; j++){
                free(table->buckets[i].loot[j].loot_name);
            }
            free(table->buckets[i].loot);
        }
    }
    free(table->buckets);
}

/*****************************************************************************/
/************************* Tree Operation Functions **************************/
/*****************************************************************************/

node_t*
insert_tree(node_t *parent, node_t *new_node){
    /* First insertion into parent */
    if (parent == NULL){
        parent = malloc(sizeof(*parent));
        assert(parent != NULL);
        parent->left = NULL;
        parent->right = NULL;
        /* edge allocated later */
        return new_node;
    }
    node_t *temp = find_node(parent, new_node->info.name);
    /* Only insert a unique location */
    if (temp == NULL || strcmp(temp->info.name, new_node->info.name) != 0){
        ;
    }
    else{
        return parent;
    }

    /* Ensure tree is a binary search tree, left to right, lowest to highest */
    if (strcmp(parent->info.name, new_node->info.name)>0){
        parent->left = insert_tree(parent->left, new_node);
    }
    else {
        parent->right = insert_tree(parent->right, new_node);
    }
    return parent;
}

/* Finds location in tree, returning a pointer to it, or NULL otherwise */
node_t*
find_node(node_t *parent, char* node_name){
    // Location doesn' exist, NULL returned;
    if (parent == NULL){
        return parent;
    }
    // Location exists, and node returned;
    else if (strcmp(parent->info.name, node_name) == 0){
        return parent;
    }
    else if (strcmp(parent->info.name, node_name)>0){
        return find_node(parent->left, node_name);
    }
    else {
        return find_node(parent->right, node_name);
    }
}

/*****************************************************************************/
/************************ LOADING GAME FILE FUNCTIONS ************************/
/*****************************************************************************/

/* Add Locations to World */
void
load_in_locations(world_t *world, file_buffer_t locations){
    int j;
    char delim[2] = "-";

    for(j=0; j<world->num_locations; j++){
        char* token;
        token = strtok(locations[j], delim);
        int i = 0;
        char first[MAX_CITY_CHARS];
        while (token != NULL){
            if(i++==0){
                strcpy(first, token);
            }
            add_location(world, token);
            /* Do not add edge to itself */
            if(i>1){
                add_edge(world, first, token);
            }
            token = strtok(NULL, delim);
        }

    }
}

/* Add location to World */
void
add_location(world_t *world, char* loc_name){
    node_t *node;
    node = malloc(sizeof(*node));
    assert(node != NULL);
    int size = sizeof(char)*(strlen(loc_name)+1);
    node->info.name = malloc(size);
    node->info.name = memcpy(node->info.name, loc_name, size);
    node->info.waypoint = 0;
    node->info.city = 0;
    node->left = NULL;
    node->right = NULL;
    node->info.edges = NULL;

    node->info.monsters = malloc(sizeof(*node->info.monsters)*INIT_ALLOC);
    assert(node->info.monsters != NULL);
    node->info.monsters_alloclen = INIT_ALLOC;
    node->info.num_monsters = 0;

    node->info.npcs = malloc(sizeof(*node->info.npcs)*INIT_ALLOC);
    assert(node->info.npcs != NULL);
    node->info.npcs_alloclen = INIT_ALLOC;
    node->info.num_npcs = 0;

    world->parent = insert_tree(world->parent, node);
}

/* Add Edge to a Location */
void
add_edge(world_t *world, char* src, char* dest){
    node_t *src_node;
    src_node = find_node(world->parent, src);
    assert (src_node != NULL && strcmp(src_node->info.name, src) == 0 && "Does not Exist");
    if (src_node->info.edges == NULL){
        src_node->info.edges = malloc(sizeof(*src_node->info.edges)*INIT_ALLOC);
        src_node->info.edge_alloclen = INIT_ALLOC;
        src_node->info.num_edges = 0;
    }
    if (src_node->info.num_edges == src_node->info.edge_alloclen){
        src_node->info.edge_alloclen *= 2;
        src_node->info.edges = realloc(src_node->info.edges, sizeof(*src_node->info.edges)*src_node->info.edge_alloclen);
    }

    int num_edge = src_node->info.num_edges;

    strcpy(src_node->info.edges[num_edge], dest);
    src_node->info.num_edges++;
}

/* Add Weapons to World*/
void
load_in_weapons(world_t *world, file_buffer_t weapons, char* delim){
    int j;
    weapon_t weapon;
    /* For each line/weapon in buffer, extract information delimited
     * and create a new weapon to be loaded into the world
     */
    for(j=0; j<world->num_weapons; j++){
        assert(j <= FILE_BUFFER_INSTANCES);
        char* token;
        token = strtok(weapons[j], delim);
        char* name;
        char* type;
        int level;
        int ar;
        int atk;
        int val;

        name = malloc(sizeof(*name) * (strlen(token)+1));
        assert(name != NULL);
        strcpy(name, token);
        token = strtok(NULL, delim);

        type = malloc(sizeof(*type) * (strlen(token)+1));
        assert(type != NULL);
        strcpy(type, token);
        token = strtok(NULL, delim);

        level = atoi(token);
        assert(level <= MAX_LVL && "Lvl too high or mistake reading from file");
        token = strtok(NULL, delim);

        ar = atoi(token);
        token = strtok(NULL, delim);

        atk = atoi(token);
        token = strtok(NULL, delim);

        val = atoi(token);
        create_weapon(&weapon, name, type, level, ar, atk, val);
        if (j==world->allocated_weapons){
            world->allocated_weapons *= 2;
            world->weapons = realloc(world->weapons, sizeof(*world->weapons) * world->allocated_weapons);
            assert(world->weapons != NULL);

        }
        world->weapons[j] = weapon;
        free(name); free(type);
    }

}

/* Add Armour to World */
void
load_in_armour(world_t *world, file_buffer_t armours, char* delim){
    int j;
    armour_t armour;
    for(j=0; j<world->num_armour; j++){
        assert(j <= FILE_BUFFER_INSTANCES);
        char* token;
        token = strtok(armours[j], delim);
        char* name;
        char* type;
        int level;
        int dr;
        int def;
        int val;

        name = malloc(sizeof(*name) * (strlen(token)+1));
        assert (name != NULL);
        strcpy(name, token);
        token = strtok(NULL, delim);

        type = malloc(sizeof(*type) * (strlen(token)+1));
        assert(type != NULL);
        strcpy(type, token);
        token = strtok(NULL, delim);

        level = atoi(token);
        assert(level <= MAX_LVL && "Level too high or mistake reading from file");
        token = strtok(NULL, delim);

        dr = atoi(token);
        token = strtok(NULL, delim);

        def = atoi(token);
        token = strtok(NULL, delim);

        val = atoi(token);
        create_armour(&armour, name, type, level, dr, def, val);
        if (j==world->allocated_armour){
            world->allocated_armour *= 2;
            world->armours = realloc(world->armours, sizeof(*world->armours) * world->allocated_armour);
            assert(world->armours != NULL);

        }
        world->armours[j] = armour;
        free(name); free(type);
    }

}

/* Add Waypoints to World */
void
load_in_waypoints(world_t *world){
    int j;
    for(j=0; j<world->num_waypoints;j++){
        node_t *temp;
        temp =find_node(world->parent, world->waypoints[j]);
        assert(temp!= NULL);
        temp->info.waypoint = 1;
    }
}

/* Add Experience Table to World */
void
load_in_exptable(world_t *world, char experiences[MAX_LVL][MAX_GETWORD_BUFFER]){
    int j;
    /* We need to delimit the string, then cast to unsigned int with strtoul */
    for(j=0; j<MAX_LVL; j++){
        char* token;
        char delim[2] = "~";
        token = strtok(experiences[j], delim);
        world->experience_table[j].level = atoi(token);
        token = strtok(NULL, delim);
        world->experience_table[j].experience_till_next = strtoul(token, NULL, 10);
        token = strtok(NULL, delim);
        world->experience_table[j].cum_experience = strtoul(token, NULL, 10);
    }
}

/* Add Items to World */
void
load_in_items(world_t *world, file_buffer_t items, char* delim){
    int j;
    item_t item;    // Each item stored here
    for(j=0; j<world->num_items; j++){
        assert(j <= FILE_BUFFER_INSTANCES);
        char* token;
        token = strtok(items[j], delim);
        char* name;
        char* type;             // Consumable or Non-Consumable
        int val;
        char* description;

        name = malloc(sizeof(*name) * (strlen(token)+1));
        assert(name != NULL);
        strcpy(name, token);
        token = strtok(NULL, delim);

        type = malloc(sizeof(*type) * (strlen(token)+1));
        assert(type != NULL);
        strcpy(type, token);
        token = strtok(NULL, delim);

        val = atoi(token);
        token = strtok(NULL, delim);

        description = malloc(sizeof(*description) * (strlen(token)+1));
        assert(description != NULL);
        strcpy(description, token);

        create_item(&item, name, type, val, description);
        if (j==world->allocated_items){
            world->allocated_items *= 2;
            world->items = realloc(world->items, sizeof(*world->items) * world->allocated_items);
            assert(world->items != NULL);
        }
        world->items[j] = item;
        free(name); free(type); free(description);
    }
}

/* Add Monsters to World */
void
load_in_monsters(world_t *world, file_buffer_t monsters, char* delim){
    int j;
    monster_t monster;
    for(j=0; j<world->num_monsters; j++){
        assert(j <= FILE_BUFFER_INSTANCES);
        char* token;
        token = strtok(monsters[j], delim);
        char* name;
        char habitat[MAX_MONSTER_NO+1][MAX_CITY_CHARS+1];
        int level;
        int hp;
        unsigned int exp;
        int aspd;
        int hits_per_attack;
        int atk;
        int ar;
        int def;
        int dr;
        int fire_res;
        int ice_res;
        int lightning_res;
        int mental_res;

        name = malloc(sizeof(*name) * (strlen(token)+1));
        assert(name != NULL);
        strcpy(name, token);
        token = strtok(NULL, delim);
        printf("Loading in: %s\n", name);

        level = atoi(token);
        token = strtok(NULL, delim);

        hp = atoi(token);
        token = strtok(NULL, delim);

        exp = strtoul(token, NULL, 10);
        token = strtok(NULL, delim);

        aspd = atoi(token);
        token = strtok(NULL, delim);

        hits_per_attack = atoi(token);
        token = strtok(NULL, delim);

        atk = atoi(token);
        token = strtok(NULL, delim);

        ar = atoi(token);
        token = strtok(NULL, delim);

        def = atoi(token);
        token = strtok(NULL, delim);

        dr = atoi(token);
        token = strtok(NULL, delim);

        fire_res = atoi(token);
        token = strtok(NULL, delim);

        ice_res = atoi(token);
        token = strtok(NULL, delim);

        lightning_res = atoi(token);
        token = strtok(NULL, delim);

        mental_res = atoi(token);
        token = strtok(NULL, delim);

        int n = 0; // Number of habitats monster inhabits
        while(memcmp(token, "==", 2*sizeof(char))){
            strcpy(habitat[n++], token);
            token = strtok(NULL, delim);
        }

        int m = 0; // Number of loot drops
        char drops[MAX_DROPS_MONSTER][MAX_WEPARM_CHARS+1];
        token = strtok(NULL, delim);
        while(token != NULL){
            if (m >= MAX_DROPS_MONSTER){
                fprintf(stderr, "Too many Loot Drops actions for %s\n", name);
                token = strtok(NULL, delim);
                continue;
            }
            strcpy(drops[m++], token);
            token = strtok(NULL, delim);
        }
        create_monster(&monster, name, habitat, n, level, hp, exp, aspd,
               hits_per_attack, atk, ar, def, dr,
               fire_res, ice_res, lightning_res, mental_res,
               drops, m);
        //monster.print_monster(&monster);
        if(j == world->allocated_monsters){
            world->allocated_monsters *= 2;
            world->monsters = realloc(world->monsters, sizeof(*world->monsters)* world->allocated_monsters);

        }
        world->monsters[j] = monster;
        for(n=0; n<monster.locations_inhabited;n++){
            world->add_monster(world, &monster, monster.native_to[n]);
        }
        free(name);
    }
}

/* Adds City Flag to Locations in the World */
void
load_in_cities(world_t *world, file_buffer_t cities, int n){
    int j;
    for(j=0; j<n; j++){
        node_t *temp;
        temp = find_node(world->parent, cities[j]);
        assert(temp!= NULL);
        temp->info.city = 1;
    }
}


/* Adds NPC to Locations in the World */
void
load_in_npcs(world_t *world, file_buffer_t npcs, char* delim){

    int j;
    npc_t npc;
    for(j=0; j<world->num_npcs; j++){
        assert(j <= FILE_BUFFER_INSTANCES);
        char* token;
        token = strtok(npcs[j], delim);

        char* name;
        char* shop_type;
        char* merchandise_type;
        char actions[MAX_NPC_ACTIONS][MAX_CITY_CHARS+1];

        name = malloc(sizeof(*name) * (strlen(token)+1));
        assert(name != NULL);
        strcpy(name, token);
        token = strtok(NULL, delim);

        shop_type = malloc(sizeof(*shop_type) * (strlen(token)+1));
        assert(shop_type != NULL);
        strcpy(shop_type, token);
        token = strtok(NULL, delim);

        merchandise_type = malloc(sizeof(*merchandise_type) * (strlen(token)+1));
        assert(merchandise_type != NULL);
        strcpy(merchandise_type, token);
        token = strtok(NULL, delim);

        int n = 0; // Number of actions for the npc;

        /* Processes actions for NPC until == delimiter */

        while(memcmp(token, "==", 2*sizeof(char))){
            if (n>= MAX_NPC_ACTIONS){
                fprintf(stderr, "Too many NPC actions for %s\n", name);
                token = strtok(NULL, delim);
                continue;
            }
            strcpy(actions[n], token);
            token = strtok(NULL, delim);
            n++;
        }

        /* Creates NPC and allocates it to the world */
        create_npc(&npc, name, shop_type, merchandise_type, actions, n);
        if(j == world->allocated_npcs){
            world->allocated_npcs *= 2;
            world->npcs = realloc(world->npcs, sizeof(*world->npcs)* world->allocated_npcs);
        }
        world->npcs[j] = npc;
        free(name); free(shop_type); free(merchandise_type);

        token = strtok(NULL, delim); // To skip the == delimiter between locations and actions

        /* After == delimiter, we add the npc to each of the locations it is resident to */
        while (token != NULL){
            node_t *temp = find_node(world->parent, token);
            assert(temp != NULL);
            if(temp->info.num_npcs == temp->info.npcs_alloclen){
                temp->info.npcs_alloclen *= 2;
                temp->info.npcs = realloc(temp->info.npcs, sizeof(*temp->info.npcs) * temp->info.npcs_alloclen);
            }
            temp->info.npcs[temp->info.num_npcs++] = npc;
            token = strtok(NULL, delim);
        }
    }
}

void
load_in_loot_table(world_t* world, file_buffer_t loot, int n, char* delim){
    int j;
    for(j=0; j<n; j++){
        char* token;
        char* key;
        int rarity;
        token = strtok(loot[j], delim);
        key = malloc(sizeof(*key) * (strlen(token)+1));
        assert(key != NULL);
        strcpy(key, token);
        token = strtok(NULL, delim);

        rarity = atoi(token);
        dict_add(world->loot_table, key, rarity);
        free(key);
    }
}

char *
mystrcasestr(char *txt, char *pat) {
    /* Attribution: assignment specifications */
	int tl=strlen(txt);
	int pl=strlen(pat);
	int i;
	for (i=0; i<=tl-pl; i++) {
	    if (strncasecmp(txt+i, pat, pl)==0) {
		return txt+i;
	    }
	}
	return NULL;
}

int
getword(char W[], int limit) {
	int c, len=0;
	/* first, skip over any non alphabetics */
	while ((c=getchar())!=EOF && !isalpha(c)) {
		/* do nothing more */
	}
	if (c==EOF) {
		return EOF;
	}
	/* ok, first character of next word has been found */
	W[len++] = c;
	while (len<limit && (c=getchar())!=EOF && c!= '\n') {
		/* another character to be stored */
		W[len++] = c;
	}
	/* now close off the string */
	W[len] = '\0';
	return 0;
}
