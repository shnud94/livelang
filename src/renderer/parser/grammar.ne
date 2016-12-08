@builtin "whitespace.ne"
@{% function flatten(list) {
        if (!Array.isArray(list)) {
          return list;
        }
        function removeNull(array) {
            return array.filter(function(e) {return e !== null;});
        };
        var flattened = list.reduce(function (acc, val) {
            return acc.concat(Array.isArray(val) ? flatten(removeNull(val)) : val);
        }, []);
        var isString = function(e) {return typeof(e) === 'string';};
        if (flattened.every(isString)) {
            return flattened.join('');
        }
        return removeNull(flattened);
    } 
%}
@{% function objectify(data, location, reject) {

    return {
      type: this.name,
      value: flatten(data)
    }
} %}

module -> "module" __ identifier __ "{" ( _ (declaration | expression) ";" _ ):* "}" {% objectify %}

declaration -> ("let" | "var") __ identifier _ (":" _ expression):? _ ("=" _ expression):? {% objectify %}

expression -> binaryExpression | prefixExpression | postfixExpression | identifier | literal
literal -> [0-9]:* ("." [0-9]:+):? | 
  "\"" [^"]:* "\""

{% objectify %}
prefixExpression -> "!" expression | "-" expression {% objectify %}
postfixExpression -> expression "(" expression:? ")" 
  | expression "." (identifier | "[" expression "]") {% objectify %}
binaryExpression -> expression _ binaryOperator _ expression {% objectify %}

program -> _ module:* _

binaryOperator -> "=" | "*" | "/" | "+" | "-" | ">" | ">=" | "<" | "<=" | "==" | "!=" | "&&" | "||"

identifier -> [a-zA-Z] [a-zA-Z0-9]:* {% objectify %}